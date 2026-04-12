"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RevenueByDayRow } from "@/types/owner-analytics";

type RevenueChartProps = {
  data: RevenueByDayRow[];
  primaryColor?: string;
};

function formatInr(n: number) {
  return `₹${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function RevenueChart({ data, primaryColor = "#FF6B35" }: RevenueChartProps) {
  const totalRevenue = data.reduce((s, r) => s + Number(r.revenue), 0);
  const totalOrders = data.reduce((s, r) => s + Number(r.order_count), 0);

  const chartData = data.map((r) => ({
    ...r,
    revenue: Number(r.revenue),
    order_count: Number(r.order_count),
    label: r.day.slice(5),
  }));

  return (
    <section className="rounded-2xl border border-muted/20 bg-surface p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-text">Revenue</h2>
      <p className="mt-0.5 text-sm text-muted">Daily totals (non-cancelled orders, UTC days)</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-muted/15 bg-background/60 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Total revenue</p>
          <p className="mt-1 text-2xl font-bold text-text">{formatInr(totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-muted/15 bg-background/60 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Total orders</p>
          <p className="mt-1 text-2xl font-bold text-text">{totalOrders}</p>
        </div>
      </div>

      <div className="mt-6 h-72 w-full min-w-0">
        {chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">No orders in this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted" />
              <YAxis
                tick={{ fontSize: 11 }}
                className="text-muted"
                tickFormatter={(v) => `₹${v}`}
              />
              <Tooltip
                formatter={(value, name) => {
                  const n = Number(value ?? 0);
                  return String(name) === "revenue"
                    ? [formatInr(n), "Revenue"]
                    : [n, "Orders"];
                }}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.day ? String(payload[0].payload.day) : ""
                }
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="revenue"
                stroke={primaryColor}
                strokeWidth={2}
                dot={{ r: 3, fill: primaryColor }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
