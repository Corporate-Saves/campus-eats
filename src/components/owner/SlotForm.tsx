"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  formatSlotLabelFromTimes,
  minutesFromMidnightHms,
  normalizeTimeToHms,
  timeIntervalsOverlap,
} from "@/lib/slots/slot-time";

export type SlotFormExisting = {
  id: string;
  start_time: string;
  end_time: string;
};

type SlotFormProps = {
  open: boolean;
  onClose: () => void;
  existingSlots: SlotFormExisting[];
  onCreated: () => void;
};

export function SlotForm({ open, onClose, existingSlots, onCreated }: SlotFormProps) {
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("12:30");
  const [label, setLabel] = useState("");
  const [labelTouched, setLabelTouched] = useState(false);
  const [maxOrders, setMaxOrders] = useState(20);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStartTime("12:00");
    setEndTime("12:30");
    setLabelTouched(false);
    setMaxOrders(20);
    try {
      setLabel(formatSlotLabelFromTimes("12:00", "12:30"));
    } catch {
      setLabel("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || labelTouched) return;
    try {
      setLabel(formatSlotLabelFromTimes(startTime, endTime));
    } catch {
      /* wait for valid times */
    }
  }, [open, startTime, endTime, labelTouched]);

  if (!open) return null;

  const validateClient = (): string | null => {
    let startHms: string;
    let endHms: string;
    try {
      startHms = normalizeTimeToHms(startTime);
      endHms = normalizeTimeToHms(endTime);
    } catch {
      return "Enter valid start and end times.";
    }
    if (minutesFromMidnightHms(endHms) <= minutesFromMidnightHms(startHms)) {
      return "End time must be after start time.";
    }
    for (const ex of existingSlots) {
      if (!ex.start_time || !ex.end_time) continue;
      if (
        timeIntervalsOverlap(startHms, endHms, String(ex.start_time), String(ex.end_time))
      ) {
        return "This range overlaps another slot.";
      }
    }
    if (!label.trim()) {
      return "Add a slot label.";
    }
    if (maxOrders < 1) {
      return "Max orders must be at least 1.";
    }
    return null;
  };

  const submit = async () => {
    const err = validateClient();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_time: startTime,
          end_time: endTime,
          label: label.trim(),
          max_orders: maxOrders,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Could not create slot");
        return;
      }
      toast.success("Slot added");
      onCreated();
      onClose();
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slot-form-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-muted/20 bg-surface p-5 shadow-lg">
        <h2 id="slot-form-title" className="text-lg font-semibold text-text">
          Add pickup slot
        </h2>
        <p className="mt-1 text-sm text-muted">
          Students choose these windows at checkout. Ranges cannot overlap.
        </p>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-text">
              Start time
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm text-text outline-none ring-primary focus:ring-2"
              />
            </label>
            <label className="block text-sm font-medium text-text">
              End time
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm text-text outline-none ring-primary focus:ring-2"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-text">
            Slot label
            <input
              type="text"
              value={label}
              onChange={(e) => {
                setLabelTouched(true);
                setLabel(e.target.value);
              }}
              maxLength={160}
              className="mt-1 w-full rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm text-text outline-none ring-primary focus:ring-2"
            />
          </label>

          <label className="block text-sm font-medium text-text">
            Max orders
            <input
              type="number"
              min={1}
              max={5000}
              value={maxOrders}
              onChange={(e) => setMaxOrders(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm text-text outline-none ring-primary focus:ring-2"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-muted/30 px-4 py-2.5 text-sm font-medium text-text hover:bg-muted/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Create slot"}
          </button>
        </div>
      </div>
    </div>
  );
}
