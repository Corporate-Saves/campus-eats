"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { API_ERROR_MESSAGE, toastApiError } from "@/lib/api-toast";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/context/TenantContext";
import { useProfile } from "@/hooks/useProfile";
import { useCartStore } from "@/store/cartStore";
import { SlotCard } from "./SlotCard";

type TimeSlotRow = {
  id: string;
  label: string | null;
  start_time: string | null;
  end_time: string | null;
  max_orders: number;
};

type SlotCountRow = {
  time_slot_id: string;
  order_count: number;
};

type StudentCheckoutProps = {
  canteenId: string;
  canteenName: string;
  scheduledFor: string;
};

export function StudentCheckout({
  canteenId,
  canteenName,
  scheduledFor,
}: StudentCheckoutProps) {
  const router = useRouter();
  const { institution } = useTenant();
  const { profile, refetch: refetchProfile } = useProfile();
  const items = useCartStore((s) => s.items);
  const canteen_id = useCartStore((s) => s.canteen_id);
  const clearCart = useCartStore((s) => s.clearCart);

  const [slots, setSlots] = useState<TimeSlotRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotChoice, setSlotChoice] = useState<"asap" | string>("asap");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cartHydrated, setCartHydrated] = useState(false);

  const primaryColor = institution?.primary_color ?? "#FF6B35";

  const subtotal = useMemo(
    () => items.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [items],
  );

  const walletBalance =
    profile?.wallet_balance != null ? Number(profile.wallet_balance) : 0;
  const canPay = walletBalance >= subtotal && subtotal > 0;

  const loadSlots = useCallback(async () => {
    if (!canteenId) return;
    setSlotsLoading(true);
    const supabase = createClient();
    const [{ data: slotRows, error: slotErr }, { data: countRows, error: countErr }] =
      await Promise.all([
        supabase
          .from("time_slots")
          .select("id, label, start_time, end_time, max_orders")
          .eq("canteen_id", canteenId)
          .eq("is_active", true)
          .order("start_time", { ascending: true }),
        supabase.rpc("get_slot_order_counts", {
          p_canteen_id: canteenId,
          p_scheduled_for: scheduledFor,
        }),
      ]);

    if (slotErr) {
      toast.error(slotErr.message || API_ERROR_MESSAGE);
      setSlots([]);
    } else {
      setSlots((slotRows ?? []) as TimeSlotRow[]);
    }

    if (countErr) {
      toast.error(countErr.message || API_ERROR_MESSAGE);
      setCounts({});
    } else {
      const map: Record<string, number> = {};
      for (const row of (countRows ?? []) as SlotCountRow[]) {
        if (row.time_slot_id) map[row.time_slot_id] = Number(row.order_count);
      }
      setCounts(map);
    }
    setSlotsLoading(false);
  }, [canteenId, scheduledFor]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    const id = setInterval(() => {
      void loadSlots();
    }, 12_000);
    return () => clearInterval(id);
  }, [loadSlots]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void loadSlots();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadSlots]);

  useEffect(() => {
    if (useCartStore.persist.hasHydrated()) {
      setCartHydrated(true);
      return;
    }
    return useCartStore.persist.onFinishHydration(() => {
      setCartHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!cartHydrated) return;
    if (items.length === 0) {
      router.replace("/student/menu");
      return;
    }
    if (!canteen_id || canteen_id !== canteenId) {
      clearCart();
      toast.error("Your cart was reset. Please add items again from the menu.");
      router.replace("/student/menu");
    }
  }, [
    cartHydrated,
    items.length,
    canteen_id,
    canteenId,
    clearCart,
    router,
  ]);

  const handleConfirm = async () => {
    if (!canPay || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canteen_id: canteenId,
          time_slot_id: slotChoice === "asap" ? null : slotChoice,
          special_instructions: instructions.trim() || undefined,
          items: items.map((i) => ({
            menu_item_id: i.menu_item_id,
            quantity: i.quantity,
          })),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        order?: { id: string; token_number: number | null };
      };

      if (!res.ok) {
        toast.error(payload.error ?? API_ERROR_MESSAGE);
        return;
      }

      if (!payload.order?.id) {
        toastApiError();
        return;
      }

      clearCart();
      await refetchProfile();
      toast.success(
        `Order placed! Token #${payload.order.token_number ?? "—"} 🎉`,
      );
      router.push(`/student/orders/${payload.order.id}`);
    } catch {
      toastApiError();
    } finally {
      setSubmitting(false);
    }
  };

  if (!cartHydrated) {
    return <p className="text-sm text-muted">Loading cart…</p>;
  }

  if (items.length === 0 || !canteen_id || canteen_id !== canteenId) {
    return (
      <p className="text-sm text-muted">Redirecting to menu…</p>
    );
  }

  return (
    <div className="pb-8">
      <h1 className="text-2xl font-bold text-text">Checkout</h1>
      {canteenName ? (
        <p className="mt-1 text-sm text-muted">{canteenName}</p>
      ) : null}
      <p className="mt-1 text-xs text-muted">Pickup date: {scheduledFor}</p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Order summary
        </h2>
        <ul className="mt-3 space-y-2 rounded-xl border border-muted/20 bg-surface p-3">
          {items.map((line) => (
            <li
              key={line.menu_item_id}
              className="flex justify-between gap-3 text-sm"
            >
              <span className="text-text">
                {line.name}{" "}
                <span className="text-muted">× {line.quantity}</span>
              </span>
              <span className="shrink-0 font-medium text-text">
                ₹{(line.price * line.quantity).toFixed(0)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-muted/15 pt-3 text-base font-bold text-text">
          <span>Total</span>
          <span>₹{subtotal.toFixed(0)}</span>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Pickup time
        </h2>
        {slotsLoading ? (
          <p className="mt-3 text-sm text-muted">Loading slots…</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setSlotChoice("asap")}
              className="w-full rounded-xl border-2 p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              style={
                slotChoice === "asap"
                  ? {
                      borderColor: primaryColor,
                      boxShadow: `0 0 0 1px ${primaryColor}40`,
                    }
                  : { borderColor: "rgba(0,0,0,0.08)" }
              }
            >
              <span className="font-semibold text-text">ASAP / Walk-in</span>
              <p className="mt-1 text-xs text-muted">
                Queue for the next available preparation window
              </p>
            </button>

            {slots.map((slot) => {
              const filled = counts[slot.id] ?? 0;
              const max = slot.max_orders;
              const full = filled >= max;
              const label =
                slot.label?.trim() ||
                [slot.start_time, slot.end_time].filter(Boolean).join(" – ") ||
                "Time slot";

              return (
                <SlotCard
                  key={slot.id}
                  label={label}
                  filled={filled}
                  max={max}
                  selected={slotChoice === slot.id}
                  disabled={full}
                  isFull={full}
                  primaryColor={primaryColor}
                  onSelect={() => {
                    if (!full) setSlotChoice(slot.id);
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8">
        <label
          htmlFor="checkout-instructions"
          className="text-sm font-semibold uppercase tracking-wide text-muted"
        >
          Special instructions
          <span className="ml-1 font-normal normal-case text-muted">
            (optional)
          </span>
        </label>
        <textarea
          id="checkout-instructions"
          rows={3}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Allergies, spice level, etc."
          className="mt-2 w-full rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm text-text outline-none ring-primary focus:ring-2"
        />
      </section>

      <section className="mt-8 rounded-xl border border-muted/20 bg-surface p-4">
        <h2 className="text-sm font-semibold text-text">Wallet</h2>
        <p className="mt-2 text-sm text-muted">
          Balance:{" "}
          <span className="font-semibold text-text">
            ₹{walletBalance.toFixed(0)}
          </span>
        </p>
        {canPay ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleConfirm()}
            className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Processing…"
              : `Pay ₹${subtotal.toFixed(0)} from Wallet`}
          </button>
        ) : (
          <div className="mt-4">
            <p className="text-sm font-medium text-amber-700">
              Insufficient balance — top up your wallet to continue.
            </p>
            <Link
              href="/student/wallet"
              className="mt-3 inline-block text-sm font-semibold text-primary underline"
            >
              Top up Wallet
            </Link>
          </div>
        )}
      </section>

      <Link
        href="/student/menu"
        className="mt-6 inline-block text-sm font-medium text-muted underline"
      >
        Back to menu
      </Link>
    </div>
  );
}
