"use client";

import {
  computePrepForecastFromTopItems,
  tomorrowUtcYyyyMmDd,
} from "@/lib/owner-analytics/compute-prep-forecast";
import type { DailyItemSaleRow, TopItemRow } from "@/types/owner-analytics";

type DemandForecastProps = {
  dailySales: DailyItemSaleRow[];
  topItems: Pick<TopItemRow, "menu_item_id" | "item_name">[];
};

export function DemandForecast({ dailySales, topItems }: DemandForecastProps) {
  const targetLabel = tomorrowUtcYyyyMmDd();
  const rows = computePrepForecastFromTopItems(dailySales, topItems);

  return (
    <section className="rounded-2xl border border-muted/20 bg-surface p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-text">Tomorrow prep suggestion</h2>
      <p className="mt-0.5 text-sm text-muted">
        Target day (UTC): <span className="font-medium text-text">{targetLabel}</span>. Based on
        top-selling items: average units sold on the same UTC weekday over up to the last 7
        occurrences, plus a 10% buffer.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          Not enough history yet. After more orders, suggested quantities will appear here.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-muted/15">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-muted/15 bg-background/50 text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="px-3 py-2 font-semibold tabular-nums">Avg sold</th>
                <th className="px-3 py-2 font-semibold tabular-nums">Suggested prep qty</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.menu_item_id} className="border-b border-muted/10 last:border-0">
                  <td className="px-3 py-2.5 font-medium text-text">{r.item_name}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted">
                    {r.avgSold.toFixed(1)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums font-semibold text-text">
                    {r.suggestedPrepQty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
