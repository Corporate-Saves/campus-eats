import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatSlotLabelFromTimes,
  normalizeTimeToHms,
  minutesFromMidnightHms,
  timeIntervalsOverlap,
} from "@/lib/slots/slot-time";
import { createClient } from "@/lib/supabase/server";
import { formatZodBodyError } from "@/lib/zod-api-error";

const postSchema = z.object({
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  label: z.string().max(160).trim().optional(),
  max_orders: z.number().int().min(1).max(5000).default(20),
});

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

export async function GET() {
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

  const { data, error } = await admin
    .from("time_slots")
    .select("id, label, start_time, end_time, max_orders, is_active")
    .eq("canteen_id", profile.canteen_id)
    .order("start_time", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const slots = (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    start_time: row.start_time,
    end_time: row.end_time,
    max_orders: row.max_orders,
    is_active: row.is_active,
  }));

  return NextResponse.json({ slots });
}

export async function POST(request: Request) {
  const res = await requireOwner();
  if ("error" in res) return res.error;
  const { profile } = res;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodBodyError(parsed.error) },
      { status: 400 },
    );
  }

  let startHms: string;
  let endHms: string;
  try {
    startHms = normalizeTimeToHms(parsed.data.start_time);
    endHms = normalizeTimeToHms(parsed.data.end_time);
  } catch {
    return NextResponse.json({ error: "Invalid start or end time" }, { status: 400 });
  }

  const startMin = minutesFromMidnightHms(startHms);
  const endMin = minutesFromMidnightHms(endHms);
  if (endMin <= startMin) {
    return NextResponse.json(
      { error: "End time must be after start time" },
      { status: 400 },
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

  const { data: existing, error: existingErr } = await admin
    .from("time_slots")
    .select("id, start_time, end_time")
    .eq("canteen_id", profile.canteen_id);

  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }

  for (const row of existing ?? []) {
    if (
      row.start_time &&
      row.end_time &&
      timeIntervalsOverlap(startHms, endHms, String(row.start_time), String(row.end_time))
    ) {
      return NextResponse.json(
        { error: "This time range overlaps an existing slot" },
        { status: 409 },
      );
    }
  }

  const label =
    parsed.data.label?.trim() ||
    formatSlotLabelFromTimes(parsed.data.start_time, parsed.data.end_time);

  const { data: created, error: insertError } = await admin
    .from("time_slots")
    .insert({
      canteen_id: profile.canteen_id,
      label,
      start_time: startHms,
      end_time: endHms,
      max_orders: parsed.data.max_orders,
      is_active: true,
    })
    .select("id, label, start_time, end_time, max_orders, is_active")
    .maybeSingle();

  if (insertError || !created) {
    return NextResponse.json(
      { error: insertError?.message ?? "Create failed" },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      slot: {
        id: created.id,
        label: created.label,
        start_time: created.start_time,
        end_time: created.end_time,
        max_orders: created.max_orders,
        is_active: created.is_active,
      },
    },
    { status: 201 },
  );
}
