"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

export function StaffHeader({
  canteenId,
  canteenName,
  initialIsOpen,
}: {
  canteenId: string;
  canteenName: string;
  initialIsOpen: boolean;
}) {
  const [now, setNow] = useState(() => new Date());
  const [isOpen, setIsOpen] = useState(initialIsOpen);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    setIsOpen(initialIsOpen);
  }, [initialIsOpen]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const toggle = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/canteens/${canteenId}/toggle`, {
        method: "PATCH",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        is_open?: boolean;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Could not update canteen");
        return;
      }
      if (typeof body.is_open === "boolean") {
        setIsOpen(body.is_open);
        toast.success(body.is_open ? "Canteen is open" : "Canteen is closed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setToggling(false);
    }
  };

  return (
    <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-muted/20 bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-text sm:text-2xl">{canteenName}</h1>
        <p className="mt-1 font-mono text-sm tabular-nums text-muted">
          {format(now, "EEE, MMM d · h:mm:ss a")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1 ring-inset",
            isOpen
              ? "bg-emerald-100 text-emerald-900 ring-emerald-300"
              : "bg-slate-200 text-slate-700 ring-slate-400",
          )}
        >
          {isOpen ? "Accepting orders" : "Closed"}
        </span>
        <button
          type="button"
          disabled={toggling}
          onClick={() => void toggle()}
          className={cn(
            "min-h-11 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50",
            isOpen ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700",
          )}
        >
          {toggling ? "…" : isOpen ? "Close canteen" : "Open canteen"}
        </button>
      </div>
    </header>
  );
}
