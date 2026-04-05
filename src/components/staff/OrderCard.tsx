"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import type { StaffQueueOrder, StaffQueueOrderStatus } from "@/types/staff-queue";

type NextAction = {
  label: string;
  status: StaffQueueOrderStatus;
  variant: "green" | "red" | "orange" | "blue" | "gray";
};

function actionsForStatus(status: StaffQueueOrderStatus): NextAction[] {
  switch (status) {
    case "PENDING":
      return [
        { label: "Accept", status: "ACCEPTED", variant: "green" },
        { label: "Reject", status: "CANCELLED", variant: "red" },
      ];
    case "ACCEPTED":
      return [{ label: "Start Preparing", status: "PREPARING", variant: "orange" }];
    case "PREPARING":
      return [{ label: "Mark Ready", status: "READY", variant: "blue" }];
    case "READY":
      return [{ label: "Mark Collected", status: "COLLECTED", variant: "gray" }];
    default:
      return [];
  }
}

const variantClass: Record<NonNullable<NextAction>["variant"], string> = {
  green: "bg-emerald-600 text-white hover:bg-emerald-700",
  red: "bg-red-600 text-white hover:bg-red-700",
  orange: "bg-orange-500 text-white hover:bg-orange-600",
  blue: "bg-sky-600 text-white hover:bg-sky-700",
  gray: "bg-slate-500 text-white hover:bg-slate-600",
};

export function OrderCard({
  order,
  highlight,
  isEntering,
  onStatusChanged,
}: {
  order: StaffQueueOrder;
  highlight: boolean;
  isEntering: boolean;
  onStatusChanged: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  const runAction = async (next: StaffQueueOrderStatus, label: string) => {
    if (loading) return;
    setLoading(label);
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Could not update order");
        return;
      }
      toast.success("Order updated");
      onStatusChanged();
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  };

  const actions = actionsForStatus(order.status);
  const placedAgo = formatDistanceToNowStrict(new Date(order.created_at), {
    addSuffix: true,
  });

  return (
    <article
      className={cn(
        "flex flex-col rounded-xl border border-muted/25 bg-surface p-4 shadow-sm transition-shadow",
        highlight && "staff-queue-card-highlight",
        isEntering && "staff-queue-card-enter",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-4xl font-black tabular-nums leading-none text-text">
          #{order.token_number ?? "—"}
        </span>
        <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted ring-1 ring-muted/20">
          {placedAgo}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-text">{order.student_name}</p>
      <ul className="mt-2 space-y-1 text-sm text-muted">
        {order.items.map((line) => (
          <li key={line.id}>
            <span className="text-text">{line.displayName}</span>
            <span className="text-muted"> × {line.quantity}</span>
          </li>
        ))}
      </ul>
      {order.special_instructions ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-950 ring-1 ring-amber-200">
          <span className="font-semibold">Note: </span>
          {order.special_instructions}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {order.slot_label ? (
          <span>
            Slot: <span className="font-medium text-text">{order.slot_label}</span>
          </span>
        ) : (
          <span className="font-medium text-text">Walk-in / ASAP</span>
        )}
        <span>
          Total:{" "}
          <span className="font-semibold text-text">
            ₹{order.total_amount.toFixed(0)}
          </span>
        </span>
      </div>
      {actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={loading != null}
              onClick={() => void runAction(a.status, a.label)}
              className={cn(
                "min-h-11 min-w-[7rem] flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50 sm:min-w-0 sm:flex-none",
                variantClass[a.variant],
              )}
            >
              {loading === a.label ? "…" : a.label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
