import { redirect } from "next/navigation";
import { StaffAvailabilityBoard } from "@/components/staff/StaffAvailabilityBoard";
import { dashboardPathForRole } from "@/lib/auth/role-routes";
import { createClient } from "@/lib/supabase/server";
import type { MenuCategoryDTO } from "@/types/menu";
import type { StaffAvailabilityItem } from "@/types/staff-availability";

export default async function StaffAvailabilityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/staff/availability");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("canteen_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.canteen_id) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-6">
        <h1 className="text-2xl font-semibold text-text">Availability</h1>
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

  const canteenId = profile.canteen_id;

  const { data: categoryRows } = await supabase
    .from("menu_categories")
    .select("id, name, sort_order")
    .eq("canteen_id", canteenId)
    .order("sort_order", { ascending: true });

  const { data: itemRows } = await supabase
    .from("menu_items")
    .select(
      "id, category_id, name, price, is_available, max_daily_quantity, prepared_quantity",
    )
    .eq("canteen_id", canteenId)
    .order("name", { ascending: true });

  const categories: MenuCategoryDTO[] = (categoryRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    sort_order: c.sort_order,
  }));

  const initialItems: StaffAvailabilityItem[] = (itemRows ?? []).map(
    (row) => ({
      id: row.id,
      category_id: row.category_id,
      name: row.name,
      price: typeof row.price === "string" ? parseFloat(row.price) : row.price,
      is_available: row.is_available,
      max_daily_quantity: row.max_daily_quantity,
      prepared_quantity: row.prepared_quantity ?? 0,
    }),
  );

  return (
    <main className="mx-auto max-w-4xl px-3 py-4 sm:px-5 sm:py-6 lg:max-w-6xl lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Item availability</h1>
        <p className="mt-1 text-sm text-muted">
          Toggle items, set daily caps, and track how much is prepared today.
        </p>
      </div>
      {initialItems.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          No menu items yet. The canteen owner can add items from the owner menu.
        </p>
      ) : (
        <StaffAvailabilityBoard
          categories={categories}
          initialItems={initialItems}
        />
      )}
    </main>
  );
}
