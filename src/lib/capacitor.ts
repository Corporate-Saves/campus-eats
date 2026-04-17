import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { PushNotifications } from "@capacitor/push-notifications";

const WEB_PUSH_PROMPT_KEY = "campus_eats_push_prompt_v1";

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

async function postDeviceToken(token: string) {
  await fetch("/api/notifications/device-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

async function syncWebPushSubscription() {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublic?.trim()) return;

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
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Native: Capacitor push + POST device token. Web: Notification permission + Web Push + existing subscribe API.
 */
export async function requestNativePushPermission(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;

    await PushNotifications.addListener("registration", async (t) => {
      try {
        await postDeviceToken(t.value);
      } catch {
        /* optional */
      }
    });

    await PushNotifications.addListener("registrationError", () => {
      /* no-op */
    });

    await PushNotifications.register();
    return;
  }

  if (typeof window === "undefined") return;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

  if (localStorage.getItem(WEB_PUSH_PROMPT_KEY)) {
    if (Notification.permission === "granted") {
      await syncWebPushSubscription();
    }
    return;
  }

  const perm = await Notification.requestPermission();
  localStorage.setItem(WEB_PUSH_PROMPT_KEY, "1");
  if (perm !== "granted") return;

  await syncWebPushSubscription();
}

export async function triggerHaptic(
  kind: "success" | "light" = "light",
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (kind === "success") {
      await Haptics.notification({ type: NotificationType.Success });
    } else {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch {
    /* ignore */
  }
}
