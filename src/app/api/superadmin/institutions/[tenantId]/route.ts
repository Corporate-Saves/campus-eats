import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin-api";
import { formatZodBodyError } from "@/lib/zod-api-error";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  is_active: z.boolean(),
});

const deleteSchema = z.object({
  confirmName: z.string().min(1),
});

type RouteParams = { params: Promise<{ tenantId: string }> };

function utcTodayYyyyMmDd() {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}

function nextUtcDay(yyyyMmDd: string): string {
  const [y, mo, d] = yyyyMmDd.split("-").map(Number);
  const u = new Date(Date.UTC(y, mo - 1, d + 1));
  return `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, "0")}-${String(u.getUTCDate()).padStart(2, "0")}`;
}

function utcMonthStart(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

function nextUtcMonthFirstFromStart(monthStartYyyyMm01: string): string {
  const [y, mo] = monthStartYyyyMm01.split("-").map(Number);
  if (mo === 12) return `${y + 1}-01-01`;
  return `${y}-${String(mo + 1).padStart(2, "0")}-01`;
}

async function sumRevenueMonth(
  admin: ReturnType<typeof createAdminClient>,
  institutionId: string,
  monthStart: string,
  monthEndExcl: string,
): Promise<number> {
  let sum = 0;
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data: chunk, error } = await admin
      .from("orders")
      .select("total_amount")
      .eq("institution_id", institutionId)
      .neq("status", "CANCELLED")
      .gte("created_at", `${monthStart}T00:00:00.000Z`)
      .lt("created_at", `${monthEndExcl}T00:00:00.000Z`)
      .range(from, from + pageSize - 1);
    if (error) return 0;
    const rows = chunk ?? [];
    for (const r of rows) {
      sum += Number(r.total_amount ?? 0);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
    if (from > 100000) break;
  }
  return sum;
}

export async function GET(_request: Request, context: RouteParams) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const { tenantId } = await context.params;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const { data: inst, error: instErr } = await admin
    .from("institutions")
    .select(
      "id, name, slug, logo_url, primary_color, domain_whitelist, is_active, created_at, deleted_at",
    )
    .eq("id", tenantId)
    .maybeSingle();

  if (instErr || !inst || inst.deleted_at != null) {
    return NextResponse.json({ error: "Institution not found" }, { status: 404 });
  }

  const today = utcTodayYyyyMmDd();
  const nextDay = nextUtcDay(today);
  const monthStart = utcMonthStart();
  const monthEndExcl = nextUtcMonthFirstFromStart(monthStart);

  const [{ count: ordersToday }, { data: orderStudents }, revenueMonth] = await Promise.all([
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", tenantId)
      .neq("status", "CANCELLED")
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lt("created_at", `${nextDay}T00:00:00.000Z`),
    admin
      .from("orders")
      .select("student_id")
      .eq("institution_id", tenantId)
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lt("created_at", `${nextDay}T00:00:00.000Z`),
    sumRevenueMonth(admin, tenantId, monthStart, monthEndExcl),
  ]);

  const dailyActiveUsers = new Set((orderStudents ?? []).map((r) => r.student_id)).size;

  return NextResponse.json({
    institution: inst,
    stats: {
      daily_active_users: dailyActiveUsers,
      orders_today: ordersToday ?? 0,
      revenue_this_month: revenueMonth,
    },
  });
}

export async function PATCH(request: Request, context: RouteParams) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const { tenantId } = await context.params;

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

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const { data: updated, error } = await admin
    .from("institutions")
    .update({ is_active: parsed.data.is_active })
    .eq("id", tenantId)
    .is("deleted_at", null)
    .select("id, is_active")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }

  return NextResponse.json({ institution: updated });
}

export async function DELETE(request: Request, context: RouteParams) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const { tenantId } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = deleteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodBodyError(parsed.error) },
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

  const { data: inst, error: instErr } = await admin
    .from("institutions")
    .select("id, name, deleted_at")
    .eq("id", tenantId)
    .maybeSingle();

  if (instErr || !inst || inst.deleted_at != null) {
    return NextResponse.json({ error: "Institution not found" }, { status: 404 });
  }

  if (parsed.data.confirmName.trim() !== inst.name.trim()) {
    return NextResponse.json(
      { error: "Institution name does not match confirmation" },
      { status: 400 },
    );
  }

  const { error: delErr } = await admin
    .from("institutions")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", tenantId);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
