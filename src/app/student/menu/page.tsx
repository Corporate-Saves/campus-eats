import { redirect } from "next/navigation";
import { MenuPage } from "@/components/student/MenuPage";
import { createClient } from "@/lib/supabase/server";
import type { MenuCategoryDTO, MenuItemDTO } from "@/types/menu";

export default async function StudentMenuPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/menu");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("institution_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.institution_id) {
    redirect("/register");
  }

  const { data: canteenRow } = await supabase
    .from("canteens")
    .select("id, name")
    .eq("institution_id", profile.institution_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!canteenRow) {
    return (
      <MenuPage
        canteenId=""
        categories={[]}
        items={[]}
        canteenName=""
      />
    );
  }

  const canteenId = canteenRow.id;

  const { data: categoryRows } = await supabase
    .from("menu_categories")
    .select("id, name, sort_order")
    .eq("canteen_id", canteenId)
    .order("sort_order", { ascending: true });

  const { data: itemRows } = await supabase
    .from("menu_items")
    .select(
      "id, category_id, name, description, price, image_url, is_veg, is_available, max_daily_quantity, prepared_quantity, tags",
    )
    .eq("canteen_id", canteenId)
    .eq("is_available", true)
    .order("name", { ascending: true });

  const categories: MenuCategoryDTO[] = (categoryRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    sort_order: c.sort_order,
  }));

  const items: MenuItemDTO[] = (itemRows ?? []).map((row) => ({
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
  }));

  return (
    <MenuPage
      canteenId={canteenId}
      categories={categories}
      items={items}
      canteenName={canteenRow.name}
    />
  );
}
