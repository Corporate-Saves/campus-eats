import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushNotification } from "@/lib/webpush";

export type NotificationType = "order_update" | "promo" | "system";

/**
 * Insert an in-app notification (service role; bypasses RLS).
 */
export async function createNotification(
  profileId: string,
  title: string,
  body: string,
  type: NotificationType,
  metadata?: Record<string, unknown> | null,
): Promise<{ id: string } | null> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data, error } = await admin
    .from("notifications")
    .insert({
      profile_id: profileId,
      title,
      body,
      type,
      metadata: metadata ?? null,
      is_read: false,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("createNotification", error.message);
    return null;
  }
  return data?.id ? { id: data.id } : null;
}

const ORDER_STATUS_MESSAGES: Record<
  string,
  { title: string; body: string }
> = {
  ACCEPTED: {
    title: "Order accepted",
    body: "The canteen has accepted your order.",
  },
  PREPARING: {
    title: "Being prepared",
    body: "Your order is now being prepared.",
  },
  READY: {
    title: "Ready for pickup",
    body: "Your order is ready — please collect it at the counter.",
  },
  COLLECTED: {
    title: "Order collected",
    body: "Your pickup has been marked complete. Enjoy!",
  },
  CANCELLED: {
    title: "Order cancelled",
    body: "Your order was not accepted. Any payment has been refunded to your wallet.",
  },
};

/**
 * In-app notification (and Web Push when READY) after a staff-driven order status change.
 */
export async function notifyStudentOrderStatus(
  studentProfileId: string,
  orderId: string,
  status: string,
): Promise<void> {
  const copy = ORDER_STATUS_MESSAGES[status];
  if (!copy) return;

  await createNotification(
    studentProfileId,
    copy.title,
    copy.body,
    "order_update",
    { order_id: orderId, status },
  );

  if (status === "READY") {
    await sendPushNotification(studentProfileId, copy.title, copy.body);
  }
}
