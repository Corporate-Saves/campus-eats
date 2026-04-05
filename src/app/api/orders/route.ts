import { format } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  canteen_id: z.string().uuid(),
  time_slot_id: z.string().uuid().nullable().optional(),
  special_instructions: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        menu_item_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1),
});

function mapRpcError(message: string): { status: number; error: string } {
  const m = message.toLowerCase();
  if (m.includes("insufficient_balance")) {
    return { status: 402, error: "Insufficient wallet balance" };
  }
  if (m.includes("slot_full")) {
    return { status: 409, error: "This time slot is full" };
  }
  if (
    m.includes("item_unavailable") ||
    m.includes("item_sold_out") ||
    m.includes("item_daily_cap")
  ) {
    return {
      status: 409,
      error: "One or more items are no longer available",
    };
  }
  if (m.includes("invalid_slot")) {
    return { status: 400, error: "Invalid pickup slot" };
  }
  if (m.includes("invalid_canteen") || m.includes("institution_mismatch")) {
    return { status: 403, error: "Invalid canteen for your account" };
  }
  if (
    m.includes("empty_cart") ||
    m.includes("bad_quantity") ||
    m.includes("profile_not_found") ||
    m.includes("not_student")
  ) {
    return { status: 400, error: "Invalid order request" };
  }
  return { status: 400, error: "Could not complete order" };
}

type CreateOrderResult = {
  order_id: string;
  token_number: number;
  total_amount: number;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, institution_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.institution_id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 400 });
  }

  if (profile.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scheduledFor = format(new Date(), "yyyy-MM-dd");

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const { data, error } = await admin.rpc("create_student_order", {
    p_student_id: user.id,
    p_canteen_id: parsed.data.canteen_id,
    p_institution_id: profile.institution_id,
    p_time_slot_id: parsed.data.time_slot_id ?? null,
    p_special_instructions: parsed.data.special_instructions ?? null,
    p_scheduled_for: scheduledFor,
    p_items: parsed.data.items,
  });

  if (error) {
    const mapped = mapRpcError(error.message ?? "");
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  const row = data as CreateOrderResult | null;
  if (!row?.order_id) {
    return NextResponse.json({ error: "Order failed" }, { status: 500 });
  }

  return NextResponse.json({
    order: {
      id: row.order_id,
      token_number: row.token_number,
      total_amount: row.total_amount,
    },
  });
}
