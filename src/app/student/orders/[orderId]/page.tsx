import { notFound, redirect } from "next/navigation";
import { OrderTracker } from "@/components/student/OrderTracker";
import { toOrderTrackerInitial } from "@/lib/orders/serialize-tracker-order";
import { createClient } from "@/lib/supabase/server";
import type { OrderTrackerLineItem } from "@/types/order-tracking";

type PageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function StudentOrderDetailPage({ params }: PageProps) {
  const { orderId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/student/orders/${orderId}`);
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      status,
      token_number,
      total_amount,
      payment_method,
      payment_status,
      special_instructions,
      scheduled_for,
      created_at,
      accepted_at,
      preparing_at,
      ready_at,
      collected_at,
      cancelled_at,
      cancellation_reason,
      time_slot_id,
      time_slots ( start_time ),
      order_items (
        id,
        quantity,
        unit_price,
        subtotal,
        menu_item_id,
        menu_items ( name )
      )
    `,
    )
    .eq("id", orderId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (error || !order) {
    notFound();
  }

  const rawItems = order.order_items ?? [];
  const lineItems: OrderTrackerLineItem[] = rawItems.map((line: {
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    menu_items: { name: string } | { name: string }[] | null;
  }) => {
    const mi = line.menu_items;
    const name =
      mi == null
        ? null
        : Array.isArray(mi)
          ? mi[0]?.name ?? null
          : mi.name;
    return {
      id: line.id,
      quantity: line.quantity,
      unit_price: line.unit_price,
      subtotal: line.subtotal,
      displayName: name ?? "Item",
    };
  });

  const initial = toOrderTrackerInitial({
    id: order.id,
    status: order.status,
    token_number: order.token_number,
    total_amount: order.total_amount,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    special_instructions: order.special_instructions,
    scheduled_for: order.scheduled_for,
    created_at: order.created_at,
    accepted_at: order.accepted_at,
    preparing_at: order.preparing_at,
    ready_at: order.ready_at,
    collected_at: order.collected_at,
    cancelled_at: order.cancelled_at,
    cancellation_reason: order.cancellation_reason,
    time_slot_id: order.time_slot_id,
    time_slots: order.time_slots,
  });

  return (
    <OrderTracker initialOrder={initial} lineItems={lineItems} />
  );
}
