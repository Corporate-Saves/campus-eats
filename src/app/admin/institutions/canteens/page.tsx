import { redirect } from "next/navigation";
import { CanteensAdminClient } from "@/components/admin/CanteensAdminClient";
import { dashboardPathForRole } from "@/lib/auth/role-routes";
import { createClient } from "@/lib/supabase/server";

export default async function InstitutionCanteensPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/institutions/canteens");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, institution_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/register");
  }

  if (profile.role !== "institution_admin") {
    redirect(dashboardPathForRole(profile.role));
  }

  if (!profile.institution_id) {
    redirect("/admin/institutions");
  }

  return (
    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-6 lg:max-w-[1400px] lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Canteens</h1>
        <p className="mt-1 text-sm text-muted">
          Create locations and assign canteen owners by email.
        </p>
      </div>
      <CanteensAdminClient />
    </main>
  );
}
