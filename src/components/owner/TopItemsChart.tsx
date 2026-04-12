"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TopItemRow } from "@/types/owner-analytics";

type TopItemsChartProps = {
  data: TopItemRow[];
  primaryColor?: string;
};

export function TopItemsChart({ data, primaryColor = "#FF6B35" }: TopItemsChartProps) {
  const chartData = [...data]
    .slice(0, 5)
    .map((r) => ({
      name:
        r.item_name.length > 22 ? `${r.item_name.slice(0, 20)}…` : r.item_name,
      fullName: r.item_name,
      quantity_sold: Number(r.quantity_sold),
    }))
    .reverse();

  return (
    <section className="rounded-2xl border border-muted/20 bg-surface p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-text">Top items</h2>
      <p className="mt-0.5 text-sm text-muted">By quantity sold in selected range</p>

      <div className="mt-4 h-72 w-full min-w-0">
        {chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">No item sales yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" horizontal />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 11 }}
                className="text-muted"
              />
              <Tooltip
                formatter={(value) => [Number(value ?? 0), "Qty sold"]}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.fullName
                    ? String(payload[0].payload.fullName)
                    : ""
                }
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              />
              <Bar dataKey="quantity_sold" fill={primaryColor} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
