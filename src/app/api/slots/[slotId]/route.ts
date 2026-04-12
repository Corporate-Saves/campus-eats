import { format } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatZodBodyError } from "@/lib/zod-api-error";

const patchSchema = z
  .object({
    max_orders: z.number().int().min(1).max(5000).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((d) => d.max_orders !== undefined || d.is_active !== undefined, {
    message: "Provide max_orders and/or is_active",
  });

type RouteParams = { params: Promise<{ slotId: string }> };

type OwnerAuth =
  | { profile: { canteen_id: string } }
  | { error: NextResponse };

async function requireOwner(): Promise<OwnerAuth> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, canteen_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile?.canteen_id) {
    return {
      error: NextResponse.json({ error: "Profile not found" }, { status: 400 }),
    };
  }
  if (profile.role !== "canteen_owner") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { profile };
}

function todayYyyyMmDd(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export async function PATCH(request: Request, context: RouteParams) {
  const { slotId } = await context.params;
  const res = await requireOwner();
  if ("error" in res) return res.error;
  const { profile } = res;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodBodyError(parsed.error) },
      { status: 400 },
    );
  }

  const updates: { max_orders?: number; is_active?: boolean } = {};
  if (parsed.data.max_orders !== undefined) {
    updates.max_orders = parsed.data.max_orders;
  }
  if (parsed.data.is_active !== undefined) {
    updates.is_active = parsed.data.is_active;
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

  const { data: updated, error: updateError } = await admin
    .from("time_slots")
    .update(updates)
    .eq("id", slotId)
    .eq("canteen_id", profile.canteen_id)
    .select("id, label, start_time, end_time, max_orders, is_active")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }

  return NextResponse.json({
    slot: {
      id: updated.id,
      label: updated.label,
      start_time: updated.start_time,
      end_time: updated.end_time,
      max_orders: updated.max_orders,
      is_active: updated.is_active,
    },
  });
}

export async function DELETE(_request: Request, context: RouteParams) {
  const { slotId } = await context.params;
  const res = await requireOwner();
  if ("error" in res) return res.error;
  const { profile } = res;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const today = todayYyyyMmDd();

  const { count, error: countError } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("time_slot_id", slotId)
    .eq("canteen_id", profile.canteen_id)
    .gte("scheduled_for", today)
    .in("status", ["PENDING", "ACCEPTED", "PREPARING", "READY"]);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "This slot still has active orders scheduled for today or later. Complete or cancel them first.",
      },
      { status: 409 },
    );
  }

  const { error: delError } = await admin
    .from("time_slots")
    .delete()
    .eq("id", slotId)
    .eq("canteen_id", profile.canteen_id);

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
