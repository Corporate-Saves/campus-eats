"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { StaffAvailabilityItem } from "@/types/staff-availability";

function mapItem(raw: Record<string, unknown>): StaffAvailabilityItem {
  const price = raw.price;
  return {
    id: String(raw.id),
    category_id: String(raw.category_id),
    name: String(raw.name),
    price: typeof price === "string" ? parseFloat(price) : Number(price),
    is_available: Boolean(raw.is_available),
    max_daily_quantity:
      raw.max_daily_quantity === null || raw.max_daily_quantity === undefined
        ? null
        : Number(raw.max_daily_quantity),
    prepared_quantity: Number(raw.prepared_quantity ?? 0),
  };
}

export function AvailabilityToggle({
  itemId,
  isAvailable,
  onApplied,
}: {
  itemId: string;
  isAvailable: boolean;
  onApplied: (item: StaffAvailabilityItem) => void;
}) {
  const [value, setValue] = useState(isAvailable);

  useEffect(() => {
    setValue(isAvailable);
  }, [isAvailable]);

  const onToggle = async () => {
    const next = !value;
    setValue(next);
    try {
      const res = await fetch(`/api/menu-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: next }),
      });
      const body = (await res.json()) as { error?: string; item?: unknown };
      if (!res.ok) {
        setValue(!next);
        toast.error(body.error ?? "Could not update availability");
        return;
      }
      if (body.item && typeof body.item === "object") {
        onApplied(mapItem(body.item as Record<string, unknown>));
      }
    } catch {
      setValue(!next);
      toast.error("Network error");
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => void onToggle()}
      className={`relative inline-flex h-8 w-14 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        value ? "bg-primary" : "bg-muted/40"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-7 w-7 translate-x-0.5 transform rounded-full bg-white shadow transition ${
          value ? "translate-x-6" : ""
        }`}
      />
    </button>
  );
}
