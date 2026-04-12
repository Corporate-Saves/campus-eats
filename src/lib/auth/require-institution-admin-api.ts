import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type InstitutionAdminContext = {
  userId: string;
  institutionId: string;
};

/**
 * Institution-scoped admin APIs: caller must be institution_admin with a non-null institution_id.
 * super_admin without an institution cannot use these routes (use tenant-level tools instead).
 */
export async function requireInstitutionAdminApi(): Promise<
  InstitutionAdminContext | { error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("institution_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.institution_id) {
    return {
      error: NextResponse.json(
        { error: "Profile or institution not found" },
        { status: 400 },
      ),
    };
  }

  if (profile.role !== "institution_admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { userId: user.id, institutionId: profile.institution_id };
}
