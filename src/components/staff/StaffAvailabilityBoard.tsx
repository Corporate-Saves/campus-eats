"use client";

import { useMemo, useState } from "react";
import type { MenuCategoryDTO } from "@/types/menu";
import type { StaffAvailabilityItem } from "@/types/staff-availability";
import { AvailabilityToggle } from "./AvailabilityToggle";
import { MaxDailyQuantityField } from "./MaxDailyQuantityField";
import { QuantityCounter } from "./QuantityCounter";

export function StaffAvailabilityBoard({
  categories,
  initialItems,
}: {
  categories: MenuCategoryDTO[];
  initialItems: StaffAvailabilityItem[];
}) {
  const [items, setItems] = useState(initialItems);

  const byCategory = useMemo(() => {
    const map = new Map<string, StaffAvailabilityItem[]>();
    for (const c of categories) {
      map.set(c.id, []);
    }
    for (const item of items) {
      const list = map.get(item.category_id);
      if (list) list.push(item);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [categories, items]);

  const mergeItem = (item: StaffAvailabilityItem) => {
    setItems((prev) => prev.map((r) => (r.id === item.id ? item : r)));
  };

  return (
    <div className="space-y-10">
      {categories.map((cat) => {
        const rows = byCategory.get(cat.id) ?? [];
        if (rows.length === 0) return null;
        return (
          <section key={cat.id}>
            <h2 className="mb-3 border-b border-muted/20 pb-2 text-lg font-semibold text-text">
              {cat.name}
            </h2>
            <ul className="divide-y divide-muted/15">
              {rows.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-4 py-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6 lg:flex-nowrap"
                >
                  <div className="min-w-0 flex-1 sm:min-w-[200px]">
                    <p className="font-medium text-text">{item.name}</p>
                    <p className="text-sm text-muted">
                      ₹{item.price.toFixed(0)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:w-40">
                    <span className="text-xs font-medium text-muted">
                      Available
                    </span>
                    <AvailabilityToggle
                      itemId={item.id}
                      isAvailable={item.is_available}
                      onApplied={mergeItem}
                    />
                  </div>
                  <div className="sm:w-44">
                    <MaxDailyQuantityField
                      itemId={item.id}
                      maxDailyQuantity={item.max_daily_quantity}
                      preparedQuantity={item.prepared_quantity}
                      onApplied={mergeItem}
                    />
                  </div>
                  <div className="min-w-0 flex-1 sm:max-w-xs">
                    <QuantityCounter
                      itemId={item.id}
                      preparedQuantity={item.prepared_quantity}
                      maxDailyQuantity={item.max_daily_quantity}
                      onApplied={mergeItem}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
