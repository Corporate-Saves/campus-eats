import { NextResponse } from "next/server";
import { requireInstitutionAdminApi } from "@/lib/auth/require-institution-admin-api";
import { adminFindUserByEmail } from "@/lib/supabase/admin-auth-users";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_ROWS = 5000;

function escapeIlike(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function csvEscape(v: string | number | null | undefined) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: Request) {
  const auth = await requireInstitutionAdminApi();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
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

  let profiles: {
    id: string;
    full_name: string | null;
    student_id: string | null;
    wallet_balance: number | string | null;
    created_at: string;
  }[] = [];

  if (search.includes("@")) {
    const { user: authUser } = await adminFindUserByEmail(admin, search.toLowerCase());
    if (!authUser) {
      profiles = [];
    } else {
      const { data: prof } = await admin
        .from("profiles")
        .select("id, full_name, student_id, wallet_balance, created_at")
        .eq("id", authUser.id)
        .eq("institution_id", institutionId)
        .eq("role", "student")
        .maybeSingle();
      profiles = prof ? [prof] : [];
    }
  } else {
    const pattern = `%${escapeIlike(search)}%`;
    let q = admin
      .from("profiles")
      .select("id, full_name, student_id, wallet_balance, created_at")
      .eq("institution_id", institutionId)
      .eq("role", "student")
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);

    if (search) {
      q = q.or(`full_name.ilike.${pattern},student_id.ilike.${pattern}`);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    profiles = data ?? [];
  }

  const lines: string[] = [
    ["Name", "Student ID", "Email", "Wallet Balance", "Last Active", "Created"].join(","),
  ];

  for (const p of profiles) {
    const { data: u } = await admin.auth.admin.getUserById(p.id);
    lines.push(
      [
        csvEscape(p.full_name),
        csvEscape(p.student_id),
        csvEscape(u.user?.email),
        csvEscape(p.wallet_balance),
        csvEscape(u.user?.last_sign_in_at ?? ""),
        csvEscape(p.created_at),
      ].join(","),
    );
  }

  const body = lines.join("\r\n");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students-export.csv"`,
    },
  });
}
