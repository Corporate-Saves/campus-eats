import { createClient } from "@/lib/supabase/server";

/**
 * Institution id from the authenticated user's profile (server).
 * Never use a client-supplied institution_id for authorization or data scoping.
 */
export async function getInstitutionIdFromSession(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("institution_id")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.institution_id ?? null;
}

/** Returns institution id or null when unauthenticated / no profile institution. */
export async function requireInstitutionId(): Promise<string> {
  const id = await getInstitutionIdFromSession();
  if (!id) {
    throw new Error("UNAUTHORIZED_OR_NO_INSTITUTION");
  }
  return id;
}
