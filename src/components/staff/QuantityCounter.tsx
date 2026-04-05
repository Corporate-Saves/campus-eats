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

export function QuantityCounter({
  itemId,
  preparedQuantity,
  maxDailyQuantity,
  onApplied,
}: {
  itemId: string;
  preparedQuantity: number;
  maxDailyQuantity: number | null;
  onApplied: (item: StaffAvailabilityItem) => void;
}) {
  const [prepared, setPrepared] = useState(preparedQuantity);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPrepared(preparedQuantity);
  }, [preparedQuantity]);

  const capped =
    maxDailyQuantity !== null && prepared >= maxDailyQuantity;

  const applyPrepared = async (next: number) => {
    if (next < 0) return;
    if (maxDailyQuantity !== null && next > maxDailyQuantity) return;
    setBusy(true);
    setPrepared(next);
    try {
      const res = await fetch(`/api/menu-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prepared_quantity: next }),
      });
      const body = (await res.json()) as { error?: string; item?: unknown };
      if (!res.ok) {
        setPrepared(preparedQuantity);
        toast.error(body.error ?? "Could not update prepared quantity");
        return;
      }
      if (body.item && typeof body.item === "object") {
        onApplied(mapItem(body.item as Record<string, unknown>));
      }
    } catch {
      setPrepared(preparedQuantity);
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  const maxLabel =
    maxDailyQuantity === null ? "∞" : String(maxDailyQuantity);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted tabular-nums">
          {prepared} / {maxLabel} prepared today
        </span>
        {capped ? (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Auto sold out
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy || prepared <= 0}
          onClick={() => void applyPrepared(prepared - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-muted/30 bg-background text-lg font-semibold text-text disabled:opacity-40"
          aria-label="Decrease prepared quantity"
        >
          −
        </button>
        <button
          type="button"
          disabled={
            busy ||
            (maxDailyQuantity !== null && prepared >= maxDailyQuantity)
          }
          onClick={() => void applyPrepared(prepared + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-muted/30 bg-background text-lg font-semibold text-text disabled:opacity-40"
          aria-label="Increase prepared quantity"
        >
          +
        </button>
      </div>
    </div>
  );
}
