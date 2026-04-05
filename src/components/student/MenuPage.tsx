"use client";

import { Search, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import type { MenuCategoryDTO, MenuItemDTO } from "@/types/menu";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { CartDrawer } from "./CartDrawer";
import { ItemCard } from "./ItemCard";

type MenuPageProps = {
  canteenId: string;
  categories: MenuCategoryDTO[];
  items: MenuItemDTO[];
  canteenName: string;
};

const ALL_ID = "__all__";

export function MenuPage({
  canteenId,
  categories,
  items,
  canteenName,
}: MenuPageProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<string>(ALL_ID);
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const cartItems = useCartStore((s) => s.items);
  const cartCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const inCat =
        activeCategoryId === ALL_ID || item.category_id === activeCategoryId;
      const matchesSearch =
        !q || item.name.toLowerCase().includes(q);
      return inCat && matchesSearch;
    });
  }, [items, activeCategoryId, search]);

  return (
    <div className="pb-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-text">Menu</h1>
        {canteenName ? (
          <p className="text-sm text-muted">{canteenName}</p>
        ) : null}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder="Search dishes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-muted/25 bg-surface py-2.5 pl-10 pr-3 text-sm text-text outline-none ring-primary focus:ring-2"
          aria-label="Search menu"
        />
      </div>

      <div className="-mx-1 mb-4 overflow-x-auto pb-1">
        <div className="flex w-max min-w-full gap-2 px-1">
          <button
            type="button"
            onClick={() => setActiveCategoryId(ALL_ID)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
              activeCategoryId === ALL_ID
                ? "bg-primary text-white"
                : "bg-background text-text ring-1 ring-muted/25 hover:bg-muted/10",
            )}
          >
            All
          </button>
          {sortedCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategoryId(cat.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
                activeCategoryId === cat.id
                  ? "bg-primary text-white"
                  : "bg-background text-text ring-1 ring-muted/25 hover:bg-muted/10",
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          No items match your filters.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filteredItems.map((item) => (
            <li key={item.id}>
              <ItemCard
                canteenId={canteenId}
                id={item.id}
                name={item.name}
                description={item.description}
                price={item.price}
                image_url={item.image_url}
                is_veg={item.is_veg}
                is_available={item.is_available}
                tags={item.tags}
                max_daily_quantity={item.max_daily_quantity}
                prepared_quantity={item.prepared_quantity}
              />
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg ring-4 ring-background transition hover:scale-105 hover:opacity-95"
        aria-label="Open cart"
      >
        <ShoppingCart className="h-6 w-6" />
        {cartCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-text px-1 text-[11px] font-bold text-white">
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        ) : null}
      </button>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </div>
  );
}
