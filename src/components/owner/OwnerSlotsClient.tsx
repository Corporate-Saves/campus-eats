"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { minutesFromMidnightHms } from "@/lib/slots/slot-time";
import { SlotForm } from "./SlotForm";

export type OwnerSlotRow = {
  id: string;
  label: string | null;
  start_time: string;
  end_time: string;
  max_orders: number;
  is_active: boolean;
};

function slotDisplayLabel(row: OwnerSlotRow): string {
  if (row.label?.trim()) return row.label.trim();
  const a = row.start_time?.slice(0, 5) ?? "";
  const b = row.end_time?.slice(0, 5) ?? "";
  if (a && b) return `${a} – ${b}`;
  return "Time slot";
}

function DayTimeline({ slots }: { slots: OwnerSlotRow[] }) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  return (
    <div className="relative h-[min(70vh,560px)] w-full overflow-hidden rounded-2xl border border-muted/20 bg-background/60">
      <div className="absolute inset-y-0 left-0 w-11 border-r border-muted/15 bg-surface/80 py-2 text-[10px] text-muted">
        {hours.map((h) => (
          <div
            key={h}
            className="absolute left-1 right-1 text-right"
            style={{ top: `${(h / 24) * 100}%`, transform: "translateY(-50%)" }}
          >
            {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
          </div>
        ))}
      </div>
      <div className="absolute inset-y-2 bottom-2 left-12 right-2">
        {hours.map((h) => (
          <div
            key={h}
            className="pointer-events-none absolute left-0 right-0 border-t border-muted/10"
            style={{ top: `${(h / 24) * 100}%` }}
          />
        ))}
        {slots.map((s) => {
          let sm: number;
          let em: number;
          try {
            sm = minutesFromMidnightHms(String(s.start_time));
            em = minutesFromMidnightHms(String(s.end_time));
          } catch {
            return null;
          }
          if (em <= sm) return null;
          const top = (sm / 1440) * 100;
          const height = ((em - sm) / 1440) * 100;
          return (
            <div
              key={s.id}
              title={slotDisplayLabel(s)}
              className="absolute left-1 right-1 rounded-lg border px-2 py-1 text-[11px] font-medium leading-tight shadow-sm"
              style={{
                top: `${top}%`,
                height: `${Math.max(height, 1.2)}%`,
                minHeight: 28,
                borderColor: s.is_active ? "var(--color-primary, #FF6B35)" : "#94a3b8",
                backgroundColor: s.is_active
                  ? "color-mix(in srgb, var(--color-primary, #FF6B35) 18%, transparent)"
                  : "rgba(148, 163, 184, 0.2)",
                color: "var(--color-text, #0f172a)",
              }}
            >
              <span className="line-clamp-2">{slotDisplayLabel(s)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OwnerSlotsClient({ initialSlots }: { initialSlots: OwnerSlotRow[] }) {
  const router = useRouter();
  const [slots, setSlots] = useState(initialSlots);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setSlots(initialSlots);
  }, [initialSlots]);

  const refresh = () => router.refresh();

  const patchSlot = async (
    id: string,
    body: { max_orders?: number; is_active?: boolean },
  ) => {
    try {
      const res = await fetch(`/api/slots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; slot?: OwnerSlotRow };
      if (!res.ok) {
        toast.error(data.error ?? "Update failed");
        return false;
      }
      if (data.slot) {
        setSlots((prev) => prev.map((s) => (s.id === id ? data.slot! : s)));
      }
      return true;
    } catch {
      toast.error("Network error");
      return false;
    }
  };

  const deleteSlot = async (id: string) => {
    if (!confirm("Delete this slot? You can only delete if there are no upcoming orders.")) {
      return;
    }
    try {
      const res = await fetch(`/api/slots/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Could not delete");
        return;
      }
      toast.success("Slot removed");
      setSlots((prev) => prev.filter((s) => s.id !== id));
      refresh();
    } catch {
      toast.error("Network error");
    }
  };

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Day overview
          </h2>
          <p className="mt-1 text-sm text-muted">
            Each block is a pickup window. Inactive slots are shown faded.
          </p>
          <div className="mt-4">
            <DayTimeline slots={slots} />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Slot cards
            </h2>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
            >
              Add slot
            </button>
          </div>

          <ul className="space-y-3">
            {slots.length === 0 ? (
              <li className="rounded-xl border border-dashed border-muted/30 bg-surface/50 p-6 text-center text-sm text-muted">
                No slots yet. Add your first pickup window.
              </li>
            ) : (
              slots.map((s) => (
                <li
                  key={s.id}
                  className="rounded-2xl border border-muted/20 bg-surface p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-text">{slotDisplayLabel(s)}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {String(s.start_time).slice(0, 5)} – {String(s.end_time).slice(0, 5)}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-text">
                      <span className="text-muted">Active</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={s.is_active}
                        onClick={() =>
                          void patchSlot(s.id, { is_active: !s.is_active })
                        }
                        className={`relative h-7 w-12 rounded-full transition ${
                          s.is_active ? "bg-primary" : "bg-muted/40"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                            s.is_active ? "left-5" : "left-0.5"
                          }`}
                        />
                      </button>
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap items-end gap-4">
                    <label className="text-sm text-text">
                      <span className="text-muted">Max orders</span>
                      <input
                        type="number"
                        min={1}
                        max={5000}
                        defaultValue={s.max_orders}
                        key={`${s.id}-${s.max_orders}`}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isNaN(v) || v < 1) {
                            e.target.value = String(s.max_orders);
                            return;
                          }
                          if (v !== s.max_orders) {
                            void patchSlot(s.id, { max_orders: v });
                          }
                        }}
                        className="mt-1 block w-24 rounded-lg border border-muted/25 bg-background px-2 py-1.5 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void deleteSlot(s.id)}
                      className="ml-auto text-sm font-medium text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <SlotForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        existingSlots={slots}
        onCreated={() => {
          refresh();
        }}
      />
    </>
  );
}
