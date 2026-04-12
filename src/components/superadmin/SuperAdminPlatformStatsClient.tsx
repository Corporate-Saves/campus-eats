"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type Totals = {
  institutions: number;
  students: number;
  orders_today: number;
  gmv_this_month: number;
};

type Row = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  students: number;
  orders_today: number;
  revenue_this_month: number;
};

export function SuperAdminPlatformStatsClient() {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/superadmin/platform-stats");
      const body = (await res.json()) as {
        totals?: Totals;
        institutions?: Row[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Could not load stats");
        setTotals(null);
        setRows([]);
        return;
      }
      setTotals(body.totals ?? null);
      setRows(body.institutions ?? []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/tenants"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Tenants
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-text">
          Platform stats
        </h1>
        <p className="mt-1 text-sm text-muted">
          Cross-tenant totals and per-institution snapshot
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !totals ? (
          <p className="col-span-full text-sm text-muted">Loading…</p>
        ) : (
          [
            ["Total institutions", totals?.institutions ?? "—"],
            ["Total students", totals?.students ?? "—"],
            ["Orders today (all tenants)", totals?.orders_today ?? "—"],
            [
              "GMV this month",
              totals != null
                ? `₹${Number(totals.gmv_this_month).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : "—",
            ],
          ].map(([label, val]) => (
            <div
              key={label}
              className="rounded-2xl border border-muted/20 bg-surface p-4 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {label}
              </p>
              <p className="mt-2 text-2xl font-bold text-text">{val}</p>
            </div>
          ))
        )}
      </div>

      <section className="rounded-2xl border border-muted/20 bg-surface p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-text">
          Institutions · metrics
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-muted/15 text-xs uppercase text-muted">
                <th className="py-2 pr-2 font-semibold">Name</th>
                <th className="py-2 pr-2 font-semibold">Slug</th>
                <th className="py-2 pr-2 font-semibold">Students</th>
                <th className="py-2 pr-2 font-semibold">Orders today</th>
                <th className="py-2 pr-2 font-semibold">Revenue (month)</th>
                <th className="py-2 pr-2 font-semibold">Status</th>
                <th className="py-2 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    No institutions.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-muted/10">
                    <td className="py-2.5 pr-2 font-medium text-text">
                      {r.name}
                    </td>
                    <td className="py-2.5 pr-2 font-mono text-muted">
                      {r.slug}
                    </td>
                    <td className="py-2.5 pr-2 tabular-nums">{r.students}</td>
                    <td className="py-2.5 pr-2 tabular-nums">
                      {r.orders_today}
                    </td>
                    <td className="py-2.5 pr-2 tabular-nums">
                      ₹
                      {Number(r.revenue_this_month).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="py-2.5 pr-2">
                      <span
                        className={
                          r.is_active
                            ? "text-xs font-medium text-emerald-700 dark:text-emerald-300"
                            : "text-xs font-medium text-muted"
                        }
                      >
                        {r.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <Link
                        href={`/admin/tenants/${r.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
