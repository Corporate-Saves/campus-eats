"use client";

import { useMemo, type ReactNode } from "react";
import type { HourlyWeekdayRow } from "@/types/owner-analytics";

function mondayFirstCol(dowSun0: number): number {
  return (dowSun0 + 6) % 7;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type HourlyHeatmapProps = {
  data: HourlyWeekdayRow[];
};

export function HourlyHeatmap({ data }: HourlyHeatmapProps) {
  const { matrix, maxVal } = useMemo(() => {
    const m: number[][] = Array.from({ length: 24 }, () =>
      Array.from({ length: 7 }, () => 0),
    );
    for (const row of data) {
      const h = row.hour;
      const col = mondayFirstCol(row.dow);
      if (h >= 0 && h < 24 && col >= 0 && col < 7) {
        m[h][col] += Number(row.order_count);
      }
    }
    let max = 0;
    for (const r of m) {
      for (const c of r) {
        if (c > max) max = c;
      }
    }
    return { matrix: m, maxVal: max };
  }, [data]);

  const cellBg = (v: number) => {
    if (maxVal <= 0) return "rgba(148, 163, 184, 0.12)";
    const t = v / maxVal;
    const a = 0.12 + t * 0.78;
    return `rgba(255, 107, 53, ${a})`;
  };

  const cells: ReactNode[] = [
    <div key="corner" className="bg-surface" />,
    ...DAY_LABELS.map((d) => (
      <div
        key={`head-${d}`}
        className="bg-surface py-1.5 text-center text-[10px] font-semibold uppercase text-muted"
      >
        {d}
      </div>
    )),
  ];

  for (let hour = 0; hour < 24; hour++) {
    cells.push(
      <div
        key={`hr-${hour}`}
        className="flex items-center justify-end bg-surface px-1 text-[10px] tabular-nums text-muted"
      >
        {hour}
      </div>,
    );
    for (let col = 0; col < 7; col++) {
      const v = matrix[hour][col];
      cells.push(
        <div
          key={`c-${hour}-${col}`}
          title={`${DAY_LABELS[col]} ${hour}:00 UTC · ${v} orders`}
          className="aspect-square min-h-[22px] min-w-[22px] rounded-sm"
          style={{ backgroundColor: cellBg(v) }}
        />,
      );
    }
  }

  return (
    <section className="rounded-2xl border border-muted/20 bg-surface p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-text">Peak hours</h2>
      <p className="mt-0.5 text-sm text-muted">
        Order density by hour (UTC) and weekday in selected range. Darker = more orders.
      </p>

      <div className="mt-4 overflow-x-auto">
        <div
          className="inline-grid gap-px bg-muted/25 p-px"
          style={{
            gridTemplateColumns: `2.25rem repeat(7, minmax(2rem, 1fr))`,
          }}
        >
          {cells}
        </div>
      </div>
    </section>
  );
}
