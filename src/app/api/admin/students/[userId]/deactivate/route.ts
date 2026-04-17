import { NextResponse } from "next/server";
import { requireInstitutionAdminApi } from "@/lib/auth/require-institution-admin-api";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ userId: string }> };

/** Long-term ban (~100y) — Supabase uses duration strings on admin.updateUserById */
const BAN_DURATION = "876000h";

export async function POST(_request: Request, context: RouteParams) {
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
    .select("id, role")
    .eq("id", userId)
    .eq("institution_id", auth.institutionId)
    .eq("role", "student")
    .maybeSingle();

  if (profErr || !prof) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: BAN_DURATION,
  });

  if (banErr) {
    return NextResponse.json({ error: banErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
