import { NextResponse } from "next/server";
import { requireInstitutionAdminApi } from "@/lib/auth/require-institution-admin-api";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, context: RouteParams) {
  const auth = await requireInstitutionAdminApi();
  if ("error" in auth) return auth.error;

  const { userId } = await context.params;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const { data: prof, error: profErr } = await admin
    .from("profiles")
    .select("id, full_name, student_id, wallet_balance, created_at, role")
    .eq("id", userId)
    .eq("institution_id", auth.institutionId)
    .eq("role", "student")
    .maybeSingle();

  if (profErr || !prof) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const { data: u } = await admin.auth.admin.getUserById(userId);

  const bannedUntil =
    u.user && "banned_until" in u.user
      ? (u.user as { banned_until?: string | null }).banned_until
      : null;

  return NextResponse.json({
    student: {
      ...prof,
      email: u.user?.email ?? "",
      last_active: u.user?.last_sign_in_at ?? null,
      banned: bannedUntil != null && bannedUntil !== "",
    },
  });
}
