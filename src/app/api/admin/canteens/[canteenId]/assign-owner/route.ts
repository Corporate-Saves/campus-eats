import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInstitutionAdminApi } from "@/lib/auth/require-institution-admin-api";
import { formatZodBodyError } from "@/lib/zod-api-error";
import { adminFindUserByEmail } from "@/lib/supabase/admin-auth-users";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
});

type RouteParams = { params: Promise<{ canteenId: string }> };

export async function POST(request: Request, context: RouteParams) {
  const auth = await requireInstitutionAdminApi();
  if ("error" in auth) return auth.error;

  const { canteenId } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
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

  const { data: canteen, error: cantErr } = await admin
    .from("canteens")
    .select("id, institution_id")
    .eq("id", canteenId)
    .maybeSingle();

  if (cantErr || !canteen || canteen.institution_id !== auth.institutionId) {
    return NextResponse.json({ error: "Canteen not found" }, { status: 404 });
  }

  const { user, error: findErr } = await adminFindUserByEmail(
    admin,
    parsed.data.email,
  );
  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json(
      { error: "No user found with that email. They must sign up first." },
      { status: 404 },
    );
  }

  const { data: prof, error: profErr } = await admin
    .from("profiles")
    .select("id, institution_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  if (!prof) {
    return NextResponse.json(
      { error: "User has no profile yet. Complete registration first." },
      { status: 400 },
    );
  }

  if (prof.institution_id !== auth.institutionId) {
    return NextResponse.json(
      { error: "User belongs to a different institution." },
      { status: 403 },
    );
  }

  if (prof.role === "institution_admin" || prof.role === "super_admin") {
    return NextResponse.json(
      { error: "This account role cannot be assigned as canteen owner." },
      { status: 400 },
    );
  }

  const { error: updErr } = await admin
    .from("profiles")
    .update({
      role: "canteen_owner",
      canteen_id: canteenId,
    })
    .eq("id", user.id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    user_id: user.id,
    email: user.email,
  });
}
