/* global self, clients, caches */
/* eslint-disable no-restricted-globals */

const STATIC_CACHE = "campus-eats-static-v2";

function isStaticAssetPath(pathname) {
  if (pathname.startsWith("/_next/static/")) return true;
  if (pathname.startsWith("/_next/image")) return true;
  return /\.(?:js|mjs|css|woff2?|png|jpe?g|gif|svg|ico|webp|map)$/i.test(
    pathname,
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok && res.type === "basic") {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, res.clone());
    }
    return res;
  } catch {
    const fallback = await caches.match("/offline.html");
    if (fallback) return fallback;
    return new Response("Offline", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll([
          "/offline.html",
          "/manifest.json",
          "/icon-192.png",
          "/icon-512.png",
        ]),
      )
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            error: "offline",
            message: "Network unavailable",
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match("/offline.html")
          .then(
            (r) =>
              r ||
              new Response("Offline", {
                status: 503,
                headers: { "Content-Type": "text/plain; charset=utf-8" },
              }),
          ),
      ),
    );
    return;
  }

  if (isStaticAssetPath(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "CampusEats", body: "", url: "/student/orders" };
  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed && typeof parsed === "object") {
        data = {
          title: typeof parsed.title === "string" ? parsed.title : data.title,
          body: typeof parsed.body === "string" ? parsed.body : data.body,
          url:
            typeof parsed.url === "string" && parsed.url.startsWith("/")
              ? parsed.url
              : data.url,
        };
      }
    }
  } catch {
    /* use defaults */
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url },
      tag: "campus-eats-order",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url || "/student/orders";
  const openUrl = new URL(path, self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url && "focus" in client) {
            void client.focus();
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(openUrl);
        }
      }),
  );
});
