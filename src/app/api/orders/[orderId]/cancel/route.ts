import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { toOrderTrackerInitial } from "@/lib/orders/serialize-tracker-order";

const bodySchema = z.object({
  reason: z.string().max(500).optional(),
});

function mapCancelRpcError(message: string): { status: number; error: string } {
  const m = message.toLowerCase();
  if (m.includes("order_not_found")) {
    return { status: 404, error: "Order not found" };
  }
  if (m.includes("forbidden")) {
    return { status: 403, error: "You cannot cancel this order" };
  }
  if (m.includes("not_cancellable")) {
    return { status: 409, error: "This order can no longer be cancelled" };
  }
  if (m.includes("cancellation_window_closed")) {
    return {
      status: 403,
      error: "Cancellation is only allowed more than 30 minutes before your pickup slot",
    };
  }
  return { status: 400, error: "Could not cancel order" };
}

type RouteParams = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, context: RouteParams) {
  const { orderId } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    /* empty body */
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const { error: rpcError } = await admin.rpc("cancel_student_order", {
    p_order_id: orderId,
    p_student_id: user.id,
    p_reason: parsed.data.reason ?? null,
  });

  if (rpcError) {
    const mapped = mapCancelRpcError(rpcError.message ?? "");
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  const { data: row, error: fetchError } = await admin
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
      time_slots ( start_time )
    `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError || !row) {
    return NextResponse.json(
      { error: "Order updated but could not be loaded" },
      { status: 500 },
    );
  }

  const order = toOrderTrackerInitial({
    id: row.id,
    status: row.status,
    token_number: row.token_number,
    total_amount: row.total_amount,
    payment_method: row.payment_method,
    payment_status: row.payment_status,
    special_instructions: row.special_instructions,
    scheduled_for: row.scheduled_for,
    created_at: row.created_at,
    accepted_at: row.accepted_at,
    preparing_at: row.preparing_at,
    ready_at: row.ready_at,
    collected_at: row.collected_at,
    cancelled_at: row.cancelled_at,
    cancellation_reason: row.cancellation_reason,
    time_slot_id: row.time_slot_id,
    time_slots: row.time_slots,
  });

  return NextResponse.json({ order });
}
