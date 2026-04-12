import { NextResponse } from "next/server";
import { requireInstitutionAdminApi } from "@/lib/auth/require-institution-admin-api";
import { adminFindUserByEmail } from "@/lib/supabase/admin-auth-users";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 50;

function escapeIlike(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function GET(request: Request) {
  const auth = await requireInstitutionAdminApi();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, Number(searchParams.get("pageSize") ?? PAGE_SIZE_DEFAULT) || PAGE_SIZE_DEFAULT),
  );
  const search = (searchParams.get("search") ?? "").trim();

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
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (search.includes("@")) {
    const email = search.toLowerCase();
    const { user: authUser, error: findErr } = await adminFindUserByEmail(admin, email);
    if (findErr || !authUser) {
      return NextResponse.json({
        students: [],
        total: 0,
        page,
        pageSize,
      });
    }

    const { data: prof } = await admin
      .from("profiles")
      .select("id, full_name, student_id, wallet_balance, created_at")
      .eq("id", authUser.id)
      .eq("institution_id", institutionId)
      .eq("role", "student")
      .maybeSingle();

    if (!prof) {
      return NextResponse.json({
        students: [],
        total: 0,
        page,
        pageSize,
      });
    }

    const row = {
      ...prof,
      email: authUser.email ?? "",
      last_active: authUser.last_sign_in_at ?? null,
    };

    return NextResponse.json({
      students: [row],
      total: 1,
      page: 1,
      pageSize,
    });
  }

  const pattern = `%${escapeIlike(search)}%`;
  let query = admin
    .from("profiles")
    .select("id, full_name, student_id, wallet_balance, created_at", {
      count: "exact",
    })
    .eq("institution_id", institutionId)
    .eq("role", "student")
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `full_name.ilike.${pattern},student_id.ilike.${pattern}`,
    );
  }

  const { data: profiles, error, count } = await query.range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = profiles ?? [];
  const enriched = await Promise.all(
    rows.map(async (p) => {
      const { data: u } = await admin.auth.admin.getUserById(p.id);
      return {
        ...p,
        email: u.user?.email ?? "",
        last_active: u.user?.last_sign_in_at ?? null,
      };
    }),
  );

  return NextResponse.json({
    students: enriched,
    total: count ?? 0,
    page,
    pageSize,
  });
}
