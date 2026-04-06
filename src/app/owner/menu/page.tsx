import { redirect } from "next/navigation";
import { OwnerMenuClient } from "@/components/owner/OwnerMenuClient";
import { dashboardPathForRole } from "@/lib/auth/role-routes";
import { createClient } from "@/lib/supabase/server";
import type { MenuCategoryDTO } from "@/types/menu";
import type { OwnerMenuItemDTO, OwnerMenuPayload } from "@/types/owner-menu";

export default async function OwnerMenuPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/owner/menu");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("canteen_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.canteen_id) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-6">
        <h1 className="text-2xl font-semibold text-text">Menu</h1>
        <p className="mt-2 text-sm text-muted">
          Your account is not linked to a canteen. Ask an institution admin to
          assign you as the canteen owner.
        </p>
      </main>
    );
  }

  if (profile.role !== "canteen_owner") {
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
      "id, category_id, name, description, price, image_url, is_veg, is_available, max_daily_quantity, prepared_quantity, tags, deleted_at",
    )
    .eq("canteen_id", canteenId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const categories: MenuCategoryDTO[] = (categoryRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    sort_order: c.sort_order,
  }));

  const items: OwnerMenuItemDTO[] = (itemRows ?? []).map((row) => ({
    id: row.id,
    category_id: row.category_id,
    name: row.name,
    description: row.description,
    price: typeof row.price === "string" ? parseFloat(row.price) : row.price,
    image_url: row.image_url,
    is_veg: row.is_veg,
    is_available: row.is_available,
    max_daily_quantity: row.max_daily_quantity,
    prepared_quantity: row.prepared_quantity ?? 0,
    tags: row.tags,
    deleted_at: row.deleted_at ?? null,
  }));

  const payload: OwnerMenuPayload = {
    categories,
    items,
    canteenId,
  };

  return (
    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-6 lg:max-w-[1400px] lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Menu management</h1>
        <p className="mt-1 text-sm text-muted">
          Organize categories, add items, and upload photos. Changes apply to
          the student menu right away.
        </p>
      </div>
      <OwnerMenuClient payload={payload} />
    </main>
  );
}
