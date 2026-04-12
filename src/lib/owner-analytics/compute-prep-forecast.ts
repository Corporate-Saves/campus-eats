import type { DailyItemSaleRow, TopItemRow } from "@/types/owner-analytics";

export type PrepForecastRow = {
  menu_item_id: string;
  item_name: string;
  avgSold: number;
  suggestedPrepQty: number;
};

/** Weekday 0–6 (Sun–Sat) for a `YYYY-MM-DD` interpreted as a UTC calendar date. */
export function utcDowFromYyyyMmDd(dateStr: string): number {
  const [y, mo, d] = dateStr.split("-").map(Number);
  if (!y || !mo || !d) return 0;
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

/** Next calendar day in UTC as `YYYY-MM-DD`. */
export function tomorrowUtcYyyyMmDd(): string {
  const now = new Date();
  const t = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  t.setUTCDate(t.getUTCDate() + 1);
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  const d = String(t.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * For each item in `topItems`, average quantity sold on the same UTC weekday as
 * tomorrow (UTC), over up to the last 7 matching UTC calendar days in `dailySales`,
 * then apply a 10% buffer (ceil).
 */
export function computePrepForecastFromTopItems(
  dailySales: DailyItemSaleRow[],
  topItems: Pick<TopItemRow, "menu_item_id" | "item_name">[],
): PrepForecastRow[] {
  const targetDow = utcDowFromYyyyMmDd(tomorrowUtcYyyyMmDd());
  const allowedIds = new Set(topItems.map((t) => t.menu_item_id));
  const nameById = new Map(topItems.map((t) => [t.menu_item_id, t.item_name]));

  const byItemDate = new Map<string, Map<string, number>>();
  for (const row of dailySales) {
    if (!allowedIds.has(row.menu_item_id)) continue;
    const d = row.sale_date;
    let dm = byItemDate.get(row.menu_item_id);
    if (!dm) {
      dm = new Map();
      byItemDate.set(row.menu_item_id, dm);
    }
    dm.set(d, (dm.get(d) ?? 0) + Number(row.quantity_sold));
  }

  const out: PrepForecastRow[] = [];

  for (const id of allowedIds) {
    const datesMap = byItemDate.get(id);
    if (!datesMap) continue;

    const matchingDates = [...datesMap.entries()]
      .filter(([dateStr]) => utcDowFromYyyyMmDd(dateStr) === targetDow)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 7);

    if (matchingDates.length === 0) continue;

    const sum = matchingDates.reduce((s, [, q]) => s + q, 0);
    const avg = sum / matchingDates.length;
    out.push({
      menu_item_id: id,
      item_name: nameById.get(id) ?? "Item",
      avgSold: avg,
      suggestedPrepQty: Math.max(0, Math.ceil(avg * 1.1)),
    });
  }

  return out.sort((a, b) => b.suggestedPrepQty - a.suggestedPrepQty);
}
