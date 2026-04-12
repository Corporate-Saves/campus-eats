import { redirect } from "next/navigation";
import { OwnerSlotsClient } from "@/components/owner/OwnerSlotsClient";
import { dashboardPathForRole } from "@/lib/auth/role-routes";
import { createClient } from "@/lib/supabase/server";

export default async function OwnerSlotsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/owner/slots");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("canteen_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.canteen_id) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-6">
        <h1 className="text-2xl font-semibold text-text">Pickup slots</h1>
        <p className="mt-2 text-sm text-muted">
          Your account is not linked to a canteen. Ask an institution admin to assign
          you as the canteen owner.
        </p>
      </main>
    );
  }

  if (profile.role !== "canteen_owner") {
    redirect(dashboardPathForRole(profile.role));
  }

  const canteenId = profile.canteen_id;

  const { data: slotRows } = await supabase
    .from("time_slots")
    .select("id, label, start_time, end_time, max_orders, is_active")
    .eq("canteen_id", canteenId)
    .order("start_time", { ascending: true });

  const initialSlots = (slotRows ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    start_time: row.start_time as string,
    end_time: row.end_time as string,
    max_orders: row.max_orders,
    is_active: row.is_active,
  }));

  return (
    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-6 lg:max-w-[1400px] lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Pickup slots</h1>
        <p className="mt-1 text-sm text-muted">
          Define time windows and capacities for student checkout. Overlapping ranges are
          not allowed.
        </p>
      </div>
      <OwnerSlotsClient initialSlots={initialSlots} />
    </main>
  );
}
