"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { OwnerMenuItemDTO, OwnerMenuPayload } from "@/types/owner-menu";
import { CategoryManager } from "./CategoryManager";
import { MenuItemForm } from "./MenuItemForm";

export function OwnerMenuClient({ payload }: { payload: OwnerMenuPayload }) {
  const router = useRouter();
  const { categories, items } = payload;

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    categories[0]?.id ?? null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OwnerMenuItemDTO | null>(null);

  useEffect(() => {
    if (
      selectedCategoryId &&
      !categories.some((c) => c.id === selectedCategoryId)
    ) {
      setSelectedCategoryId(categories[0]?.id ?? null);
    }
  }, [categories, selectedCategoryId]);

  const filteredItems = useMemo(() => {
    if (!selectedCategoryId) return [];
    return items.filter((i) => i.category_id === selectedCategoryId);
  }, [items, selectedCategoryId]);

  const refresh = () => {
    router.refresh();
  };

  const openCreate = () => {
    setEditingItem(null);
    setFormOpen(true);
  };

  const openEdit = (item: OwnerMenuItemDTO) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const deleteItem = async (item: OwnerMenuItemDTO) => {
    if (!confirm(`Remove “${item.name}” from the menu?`)) return;
    try {
      const res = await fetch(`/api/menu-items/${item.id}`, {
        method: "DELETE",
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Could not remove item");
        return;
      }
      toast.success("Item removed");
      refresh();
    } catch {
      toast.error("Network error");
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="shrink-0 rounded-2xl border border-muted/20 bg-background/80 p-4 lg:w-72">
          <CategoryManager categories={categories} onChanged={refresh} />
        </aside>

        <section className="min-w-0 flex-1 rounded-2xl border border-muted/20 bg-background/80 p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text">Menu items</h2>
              {selectedCategoryId ? (
                <p className="text-sm text-muted">
                  {categories.find((c) => c.id === selectedCategoryId)?.name}
                </p>
              ) : (
                <p className="text-sm text-muted">Add a category to begin</p>
              )}
            </div>
            <button
              type="button"
              disabled={categories.length === 0}
              onClick={openCreate}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              Add item
            </button>
          </div>

          {categories.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(c.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    selectedCategoryId === c.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/20 text-text hover:bg-muted/30"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {filteredItems.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">
              {categories.length === 0
                ? "Create a category, then add items."
                : "No items in this category yet."}
            </p>
          ) : (
            <ul className="divide-y divide-muted/15">
              {filteredItems.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-muted/20 bg-muted/10">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-muted">
                          No img
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-text">{item.name}</p>
                      <p className="text-sm text-muted">
                        ₹{item.price.toFixed(0)} ·{" "}
                        {item.is_veg ? "Veg" : "Non-veg"} ·{" "}
                        {item.is_available ? "Available" : "Hidden"}
                      </p>
                      {item.tags && item.tags.length > 0 ? (
                        <p className="mt-1 text-xs text-muted">
                          {item.tags.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="rounded-lg border border-muted/30 px-3 py-1.5 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteItem(item)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 dark:border-red-900 dark:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <MenuItemForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingItem(null);
        }}
        categories={categories}
        editingItem={editingItem}
        defaultCategoryId={selectedCategoryId}
        onSaved={refresh}
      />
    </>
  );
}
