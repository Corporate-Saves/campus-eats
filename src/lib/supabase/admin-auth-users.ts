import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Resolve a user by email via Admin API (paginated listUsers).
 */
export async function adminFindUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ user: User | null; error: Error | null }> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      return { user: null, error: new Error(error.message) };
    }
    const u = data.users.find((x) => x.email?.toLowerCase() === target) ?? null;
    if (u) return { user: u, error: null };
    if (data.users.length < 200) break;
  }
  return { user: null, error: null };
}
