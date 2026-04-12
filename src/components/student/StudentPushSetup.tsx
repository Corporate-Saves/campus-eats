"use client";

import { useEffect, useRef } from "react";

const PROMPT_KEY = "campus_eats_push_prompt_v1";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * One-time browser prompt for Web Push; registers /public/sw.js and POSTs subscription to the API.
 */
export function StudentPushSetup() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublic?.trim()) return;

    void (async () => {
      if (localStorage.getItem(PROMPT_KEY)) {
        if (Notification.permission === "granted") {
          await syncSubscription(vapidPublic);
        }
        return;
      }

      const perm = await Notification.requestPermission();
      localStorage.setItem(PROMPT_KEY, "1");

      if (perm !== "granted") return;

      await syncSubscription(vapidPublic);
    })();
  }, []);

  return null;
}

async function syncSubscription(vapidPublic: string) {
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;

    const key = urlBase64ToUint8Array(vapidPublic);
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key as unknown as BufferSource,
      });
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

    await fetch("/api/notifications/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        expirationTime: json.expirationTime ?? null,
      }),
    });
  } catch {
    /* ignore — push is optional */
  }
}
