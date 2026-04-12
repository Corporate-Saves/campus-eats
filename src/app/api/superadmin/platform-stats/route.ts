import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin-api";
import { createAdminClient } from "@/lib/supabase/admin";

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

async function sumGmvMonth(admin: ReturnType<typeof createAdminClient>): Promise<number> {
  const monthStart = utcMonthStart();
  const monthEndExcl = nextUtcMonthFirstFromStart(monthStart);
  let sum = 0;
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data: chunk, error } = await admin
      .from("orders")
      .select("total_amount")
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
    if (from > 200000) break;
  }
  return sum;
}

export async function GET() {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const today = utcTodayYyyyMmDd();
  const nextDay = nextUtcDay(today);

  const [
    { count: institutionCount },
    { count: studentCount },
    { count: ordersToday },
    gmvMonth,
    { data: insts },
  ] = await Promise.all([
    admin
      .from("institutions")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student"),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .neq("status", "CANCELLED")
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lt("created_at", `${nextDay}T00:00:00.000Z`),
    sumGmvMonth(admin),
    admin
      .from("institutions")
      .select("id, name, slug, is_active")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
  ]);

  const ids = (insts ?? []).map((i) => i.id);
  const studentBy: Record<string, number> = {};
  const ordersTodayBy: Record<string, number> = {};
  const revenueMonthBy: Record<string, number> = {};
  const monthStart = utcMonthStart();
  const monthEndExcl = nextUtcMonthFirstFromStart(monthStart);

  if (ids.length > 0) {
    const { data: studs } = await admin
      .from("profiles")
      .select("institution_id")
      .eq("role", "student")
      .in("institution_id", ids);
    for (const s of studs ?? []) {
      if (!s.institution_id) continue;
      studentBy[s.institution_id] = (studentBy[s.institution_id] ?? 0) + 1;
    }

    const { data: ordToday } = await admin
      .from("orders")
      .select("institution_id")
      .in("institution_id", ids)
      .neq("status", "CANCELLED")
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lt("created_at", `${nextDay}T00:00:00.000Z`);
    for (const o of ordToday ?? []) {
      ordersTodayBy[o.institution_id] = (ordersTodayBy[o.institution_id] ?? 0) + 1;
    }

    const { data: ordMonth } = await admin
      .from("orders")
      .select("institution_id, total_amount")
      .in("institution_id", ids)
      .neq("status", "CANCELLED")
      .gte("created_at", `${monthStart}T00:00:00.000Z`)
      .lt("created_at", `${monthEndExcl}T00:00:00.000Z`);
    for (const o of ordMonth ?? []) {
      revenueMonthBy[o.institution_id] =
        (revenueMonthBy[o.institution_id] ?? 0) + Number(o.total_amount ?? 0);
    }
  }

  const rows = (insts ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    slug: i.slug,
    is_active: i.is_active,
    students: studentBy[i.id] ?? 0,
    orders_today: ordersTodayBy[i.id] ?? 0,
    revenue_this_month: revenueMonthBy[i.id] ?? 0,
  }));

  return NextResponse.json({
    totals: {
      institutions: institutionCount ?? 0,
      students: studentCount ?? 0,
      orders_today: ordersToday ?? 0,
      gmv_this_month: gmvMonth,
    },
    institutions: rows,
  });
}
