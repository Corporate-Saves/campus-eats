import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let vapidConfigured = false;

function configureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:admin@campuseats.local";
  if (!publicKey || !privateKey) {
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

type PushSubscriptionJSON = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
  expirationTime?: number | null;
};

/**
 * Send a Web Push to the user's stored subscription (if any). No-op when VAPID or subscription missing.
 */
export async function sendPushNotification(
  profileId: string,
  title: string,
  body: string,
): Promise<void> {
  if (!configureVapid()) {
    return;
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return;
  }

  const { data: row, error } = await admin
    .from("profiles")
    .select("push_subscription")
    .eq("id", profileId)
    .maybeSingle();

  if (error || !row?.push_subscription) {
    return;
  }

  const raw = row.push_subscription as unknown;
  if (!raw || typeof raw !== "object") {
    return;
  }

  const sub = raw as PushSubscriptionJSON;
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return;
  }

  const payload = JSON.stringify({
    title,
    body,
    url: "/student/orders",
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
        expirationTime: sub.expirationTime ?? undefined,
      },
      payload,
      { TTL: 60 * 60 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg.includes("410") ||
      msg.toLowerCase().includes("gone") ||
      msg.toLowerCase().includes("unsubscribed")
    ) {
      await admin
        .from("profiles")
        .update({ push_subscription: null })
        .eq("id", profileId);
    } else {
      console.error("sendPushNotification", msg);
    }
  }
}
