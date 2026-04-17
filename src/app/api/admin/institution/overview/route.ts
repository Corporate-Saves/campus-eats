import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInstitutionAdminApi } from "@/lib/auth/require-institution-admin-api";

export const runtime = "nodejs";

function utcMonthStart(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

function utcTodayYyyyMmDd() {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}

function nextUtcDay(yyyyMmDd: string): string {
  const [y, mo, d] = yyyyMmDd.split("-").map(Number);
  const u = new Date(Date.UTC(y, mo - 1, d + 1));
  return `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, "0")}-${String(u.getUTCDate()).padStart(2, "0")}`;
}

/** First day of the next calendar month after `monthStart` (which must be YYYY-MM-01). */
function nextUtcMonthFirstDayFromStart(monthStartYyyyMm01: string): string {
  const [y, mo] = monthStartYyyyMm01.split("-").map(Number);
  if (mo === 12) return `${y + 1}-01-01`;
  return `${y}-${String(mo + 1).padStart(2, "0")}-01`;
}

export async function GET() {
  const auth = await requireInstitutionAdminApi();
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

  const { institutionId } = auth;
  const today = utcTodayYyyyMmDd();
  const monthStart = utcMonthStart();
  const monthEndExclusive = nextUtcMonthFirstDayFromStart(monthStart);

  const [
    instRes,
    studentsRes,
    ordersTodayRes,
    revenueRes,
    canteensRes,
  ] = await Promise.all([
    admin.from("institutions").select("name").eq("id", institutionId).maybeSingle(),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .eq("role", "student"),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .neq("status", "CANCELLED")
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lt("created_at", `${nextUtcDay(today)}T00:00:00.000Z`),

    Promise.resolve().then(async () => {
      let sum = 0;
      let from = 0;
      const pageSize = 1000;
      for (;;) {
        const { data: chunk, error: chErr } = await admin
          .from("orders")
          .select("total_amount")
          .eq("institution_id", institutionId)
          .neq("status", "CANCELLED")
          .gte("created_at", `${monthStart}T00:00:00.000Z`)
          .lt("created_at", `${monthEndExclusive}T00:00:00.000Z`)
          .range(from, from + pageSize - 1);
        if (chErr) return { error: chErr, sum: 0 };
        const rows = chunk ?? [];
        for (const r of rows) {
          sum += Number(r.total_amount ?? 0);
        }
        if (rows.length < pageSize) break;
        from += pageSize;
        if (from > 100000) break;
      }
      return { error: null, sum };
    }),
    admin
      .from("canteens")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", institutionId),
  ]);

  if (instRes.error) {
    return NextResponse.json({ error: instRes.error.message }, { status: 500 });
  }

  if ("error" in revenueRes && revenueRes.error) {
    return NextResponse.json(
      { error: revenueRes.error.message },
      { status: 500 },
    );
  }

  const revenueSum =
    "sum" in revenueRes ? revenueRes.sum : 0;

  return NextResponse.json({
    institution: { name: instRes.data?.name ?? "Institution" },
    totalStudents: studentsRes.count ?? 0,
    activeOrdersToday: ordersTodayRes.count ?? 0,
    revenueThisMonth: revenueSum,
    canteenCount: canteensRes.count ?? 0,
  });
}
