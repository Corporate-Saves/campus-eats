"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/order-tracking";

export type StudentOrderRow = {
  id: string;
  created_at: string;
  token_number: number | null;
  total_amount: number;
  status: OrderStatus;
  scheduled_for: string | null;
};

const TABS = [
  { id: "all" as const, label: "All" },
  { id: "active" as const, label: "Active" },
  { id: "completed" as const, label: "Completed" },
  { id: "cancelled" as const, label: "Cancelled" },
];

const ACTIVE: OrderStatus[] = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
];

function badgeClass(status: OrderStatus): string {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    case "ACCEPTED":
    case "PREPARING":
      return "bg-sky-100 text-sky-900 ring-sky-200";
    case "READY":
      return "bg-emerald-100 text-emerald-900 ring-emerald-200";
    case "COLLECTED":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "CANCELLED":
      return "bg-red-100 text-red-800 ring-red-200";
    default:
      return "bg-muted/20 text-muted ring-muted/30";
  }
}

function filterOrders(
  rows: StudentOrderRow[],
  tab: (typeof TABS)[number]["id"],
): StudentOrderRow[] {
  if (tab === "all") return rows;
  if (tab === "active") {
    return rows.filter((r) => ACTIVE.includes(r.status));
  }
  if (tab === "completed") {
    return rows.filter((r) => r.status === "COLLECTED");
  }
  return rows.filter((r) => r.status === "CANCELLED");
}

export function StudentOrdersList({ orders }: { orders: StudentOrderRow[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");

  const filtered = useMemo(() => filterOrders(orders, tab), [orders, tab]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Orders</h1>
      <p className="mt-1 text-sm text-muted">Your order history</p>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
              tab === t.id
                ? "bg-primary text-white"
                : "bg-background text-text ring-1 ring-muted/25 hover:bg-muted/10",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">
          No orders in this view.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {filtered.map((row) => (
            <li key={row.id}>
              <Link
                href={`/student/orders/${row.id}`}
                className="flex flex-col gap-2 rounded-xl border border-muted/20 bg-surface p-4 transition hover:border-primary/30 hover:bg-background"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-muted">
                    {format(parseISO(row.created_at), "MMM d, yyyy · h:mm a")}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
                      badgeClass(row.status),
                    )}
                  >
                    {row.status.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold text-text">
                      Token #{row.token_number ?? "—"}
                    </p>
                    {row.scheduled_for ? (
                      <p className="text-xs text-muted">
                        Pickup {row.scheduled_for}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-base font-semibold text-text">
                    ₹{row.total_amount.toFixed(0)}
                  </p>
                </div>
                <span className="text-xs font-medium text-primary">
                  View tracking →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
