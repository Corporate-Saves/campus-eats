"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { OrderStatusRow } from "@/types/owner-analytics";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#94a3b8",
  ACCEPTED: "#60a5fa",
  PREPARING: "#a78bfa",
  READY: "#fbbf24",
  COLLECTED: "#34d399",
  CANCELLED: "#f87171",
};

type OrderStatusPieProps = {
  data: OrderStatusRow[];
};

export function OrderStatusPie({ data }: OrderStatusPieProps) {
  const chartData = data.map((r) => ({
    name: r.status.replace(/_/g, " "),
    status: r.status,
    value: Number(r.count),
  }));

  const total = chartData.reduce((s, r) => s + r.value, 0);

  return (
    <section className="rounded-2xl border border-muted/20 bg-surface p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-text">Orders by status</h2>
      <p className="mt-0.5 text-sm text-muted">Today (UTC date of order creation)</p>

      <div className="mt-4 h-64 w-full min-w-0">
        {total === 0 ? (
          <p className="py-12 text-center text-sm text-muted">No orders placed today.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={88}
                paddingAngle={2}
                label={({ name, percent }) =>
                  `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_COLORS[entry.status] ?? "#cbd5e1"}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [Number(value ?? 0), "Orders"]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {total > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
          {chartData.map((r) => (
            <li key={r.status} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: STATUS_COLORS[r.status] ?? "#cbd5e1",
                }}
              />
              <span className="text-text">{r.name}</span>
              <span>({r.value})</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
