import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type SuperAdminContext = {
  userId: string;
};

export async function requireSuperAdminApi(): Promise<
  SuperAdminContext | { error: NextResponse }
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
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "super_admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { userId: user.id };
}
