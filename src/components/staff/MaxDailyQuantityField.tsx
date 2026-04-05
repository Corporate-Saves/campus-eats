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

export function MaxDailyQuantityField({
  itemId,
  maxDailyQuantity,
  preparedQuantity,
  onApplied,
}: {
  itemId: string;
  maxDailyQuantity: number | null;
  preparedQuantity: number;
  onApplied: (item: StaffAvailabilityItem) => void;
}) {
  const [draft, setDraft] = useState(
    maxDailyQuantity === null ? "" : String(maxDailyQuantity),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(maxDailyQuantity === null ? "" : String(maxDailyQuantity));
  }, [maxDailyQuantity]);

  const patchMax = async (next: number | null) => {
    if (next !== null && next < 0) return;
    if (next !== null && preparedQuantity > next) {
      toast.error("Max cannot be below current prepared quantity");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/menu-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_daily_quantity: next }),
      });
      const body = (await res.json()) as { error?: string; item?: unknown };
      if (!res.ok) {
        toast.error(body.error ?? "Could not update daily max");
        return;
      }
      if (body.item && typeof body.item === "object") {
        onApplied(mapItem(body.item as Record<string, unknown>));
      }
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      const same = maxDailyQuantity === null;
      if (same) return;
      void patchMax(null);
      return;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error("Enter a whole number ≥ 0, or leave empty for no cap");
      return;
    }
    const next = parsed;
    if (maxDailyQuantity === next) return;
    void patchMax(next);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">Daily max</span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={0}
          disabled={busy}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitDraft()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          placeholder="No cap"
          className="h-9 w-24 rounded-lg border border-muted/30 bg-background px-2 text-sm tabular-nums text-text"
        />
        <button
          type="button"
          disabled={busy || maxDailyQuantity === null}
          onClick={() => void patchMax(null)}
          className="rounded-lg border border-muted/30 px-2 py-1.5 text-xs font-medium text-muted hover:bg-muted/10 disabled:opacity-40"
        >
          Clear cap
        </button>
      </div>
    </div>
  );
}
