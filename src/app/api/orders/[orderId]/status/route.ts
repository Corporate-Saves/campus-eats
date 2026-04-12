import { NextResponse } from "next/server";
import { z } from "zod";
import { notifyStudentOrderStatus } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  mapRowToStaffQueueOrder,
  STAFF_QUEUE_ORDER_SELECT,
} from "@/lib/staff/map-queue-order";

const bodySchema = z.object({
  status: z.enum([
    "ACCEPTED",
    "PREPARING",
    "READY",
    "COLLECTED",
    "CANCELLED",
  ]),
});

const ALLOWED_NEXT: Record<string, string[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING"],
  PREPARING: ["READY"],
  READY: ["COLLECTED"],
};

type RouteParams = { params: Promise<{ orderId: string }> };

export async function PATCH(request: Request, context: RouteParams) {
  const { orderId } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, canteen_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.canteen_id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 400 });
  }

  if (
    profile.role !== "canteen_staff" &&
    profile.role !== "canteen_owner"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const nextStatus = parsed.data.status;

  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .select("id, status, canteen_id, student_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !orderRow) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (orderRow.canteen_id !== profile.canteen_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const current = orderRow.status;
  const allowed = ALLOWED_NEXT[current] ?? [];
  if (!allowed.includes(nextStatus)) {
    return NextResponse.json(
      { error: `Cannot move order from ${current} to ${nextStatus}` },
      { status: 409 },
    );
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

  if (nextStatus === "CANCELLED") {
    const { error: rpcError } = await admin.rpc("staff_cancel_order_refund", {
      p_order_id: orderId,
      p_canteen_id: profile.canteen_id,
    });

    if (rpcError) {
      const m = rpcError.message?.toLowerCase() ?? "";
      if (m.includes("order_not_found")) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      if (m.includes("forbidden")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (m.includes("invalid_status")) {
        return NextResponse.json(
          { error: "Only pending orders can be rejected" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: rpcError.message }, { status: 400 });
    }

    await notifyStudentOrderStatus(orderRow.student_id, orderId, "CANCELLED");
  } else {
    const { error: rpcTransitionError } = await admin.rpc(
      "staff_transition_order_status",
      {
        p_order_id: orderId,
        p_canteen_id: profile.canteen_id,
        p_next_status: nextStatus,
      },
    );

    if (rpcTransitionError) {
      const m = rpcTransitionError.message?.toLowerCase() ?? "";
      if (m.includes("order_not_found")) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      if (m.includes("forbidden")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (m.includes("invalid_transition")) {
        return NextResponse.json(
          {
            error:
              "Order status changed or this transition is not allowed. Refresh and try again.",
          },
          { status: 409 },
        );
      }
      if (m.includes("use_staff_cancel_order_refund")) {
        return NextResponse.json(
          { error: "Server configuration error" },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { error: rpcTransitionError.message },
        { status: 400 },
      );
    }

    await notifyStudentOrderStatus(orderRow.student_id, orderId, nextStatus);
  }

  const { data: full, error: fullError } = await admin
    .from("orders")
    .select(STAFF_QUEUE_ORDER_SELECT)
    .eq("id", orderId)
    .eq("canteen_id", profile.canteen_id)
    .maybeSingle();

  if (fullError || !full) {
    return NextResponse.json({ error: "Order updated but could not load" }, { status: 500 });
  }

  const order = mapRowToStaffQueueOrder(
    full as Parameters<typeof mapRowToStaffQueueOrder>[0],
  );

  return NextResponse.json({ order });
}
