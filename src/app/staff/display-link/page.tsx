import { redirect } from "next/navigation";
import { StaffDisplayLinkClient } from "@/components/staff/StaffDisplayLinkClient";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { dashboardPathForRole } from "@/lib/auth/role-routes";
import { createClient } from "@/lib/supabase/server";

export default async function StaffDisplayLinkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/staff/display-link");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("canteen_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.canteen_id) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-6">
        <h1 className="text-2xl font-semibold text-text">TV display</h1>
        <p className="mt-2 text-sm text-muted">
          Your account is not assigned to a canteen. Ask an institution admin to
          link you to a kitchen.
        </p>
      </main>
    );
  }

  if (
    profile.role !== "canteen_staff" &&
    profile.role !== "canteen_owner"
  ) {
    redirect(dashboardPathForRole(profile.role));
  }

  const { data: canteen, error: canteenError } = await supabase
    .from("canteens")
    .select("id, name, is_open")
    .eq("id", profile.canteen_id)
    .maybeSingle();

  if (canteenError || !canteen) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-6">
        <h1 className="text-2xl font-semibold text-text">TV display</h1>
        <p className="mt-2 text-sm text-muted">Canteen not found.</p>
      </main>
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

  return (
    <main className="mx-auto max-w-3xl px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <StaffHeader
        canteenId={canteen.id}
        canteenName={canteen.name}
        initialIsOpen={canteen.is_open}
      />
      <StaffDisplayLinkClient
        canteenId={canteen.id}
        baseUrl={baseUrl}
        canteenName={canteen.name}
      />
    </main>
  );
}
