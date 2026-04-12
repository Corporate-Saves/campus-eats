import { redirect } from "next/navigation";
import { OwnerAnalyticsClient } from "@/components/owner/OwnerAnalyticsClient";
import { dashboardPathForRole } from "@/lib/auth/role-routes";
import { createClient } from "@/lib/supabase/server";

export default async function OwnerAnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/owner/analytics");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("canteen_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.canteen_id) {
    return (
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-6 lg:max-w-[1400px] lg:px-8">
        <h1 className="text-2xl font-semibold text-text">Analytics</h1>
        <p className="mt-2 text-sm text-muted">
          Your account is not linked to a canteen. Ask an institution admin to assign you as
          the canteen owner.
        </p>
      </main>
    );
  }

  if (profile.role !== "canteen_owner") {
    redirect(dashboardPathForRole(profile.role));
  }

  return (
    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-6 lg:max-w-[1400px] lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Analytics</h1>
        <p className="mt-1 text-sm text-muted">
          Revenue, bestsellers, order mix, peak times, and a simple prep forecast for tomorrow.
        </p>
      </div>
      <OwnerAnalyticsClient canteenId={profile.canteen_id} />
    </main>
  );
}
