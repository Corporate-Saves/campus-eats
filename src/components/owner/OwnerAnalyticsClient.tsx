"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { eachDayOfInterval, format, parseISO, startOfDay, subDays } from "date-fns";
import toast from "react-hot-toast";
import { useTenant } from "@/context/TenantContext";
import { createClient } from "@/lib/supabase/client";
import type {
  DailyItemSaleRow,
  HourlyWeekdayRow,
  OrderStatusRow,
  RevenueByDayRow,
  TopItemRow,
} from "@/types/owner-analytics";
import { DemandForecast } from "./DemandForecast";
import { HourlyHeatmap } from "./HourlyHeatmap";
import { OrderStatusPie } from "./OrderStatusPie";
import { RevenueChart } from "./RevenueChart";
import { TopItemsChart } from "./TopItemsChart";

type Preset = "today" | "7d" | "30d" | "custom";

function rangeForPreset(
  preset: Preset,
  customStart: string,
  customEnd: string,
): { start: string; end: string } {
  const end = startOfDay(new Date());
  const endStr = format(end, "yyyy-MM-dd");
  if (preset === "today") {
    return { start: endStr, end: endStr };
  }
  if (preset === "7d") {
    return { start: format(subDays(end, 6), "yyyy-MM-dd"), end: endStr };
  }
  if (preset === "30d") {
    return { start: format(subDays(end, 29), "yyyy-MM-dd"), end: endStr };
  }
  return { start: customStart, end: customEnd };
}

function fillRevenueGaps(
  rows: RevenueByDayRow[],
  start: string,
  end: string,
): RevenueByDayRow[] {
  const startD = parseISO(start);
  const endD = parseISO(end);
  const days = eachDayOfInterval({ start: startD, end: endD });
  const map = new Map(rows.map((r) => [r.day, r]));
  return days.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return map.get(key) ?? { day: key, revenue: 0, order_count: 0 };
  });
}

export function OwnerAnalyticsClient({ canteenId }: { canteenId: string }) {
  const { institution } = useTenant();
  const primaryColor = institution?.primary_color ?? "#FF6B35";

  const [preset, setPreset] = useState<Preset>("7d");
  const [customStart, setCustomStart] = useState(() =>
    format(subDays(startOfDay(new Date()), 6), "yyyy-MM-dd"),
  );
  const [customEnd, setCustomEnd] = useState(() =>
    format(startOfDay(new Date()), "yyyy-MM-dd"),
  );

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => rangeForPreset(preset, customStart, customEnd),
    [preset, customStart, customEnd],
  );

  const statusToday = format(startOfDay(new Date()), "yyyy-MM-dd");

  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState<RevenueByDayRow[]>([]);
  const [topItems, setTopItems] = useState<TopItemRow[]>([]);
  const [statusRows, setStatusRows] = useState<OrderStatusRow[]>([]);
  const [heatmapRows, setHeatmapRows] = useState<HourlyWeekdayRow[]>([]);
  const [dailySales, setDailySales] = useState<DailyItemSaleRow[]>([]);
  const [topForForecast, setTopForForecast] = useState<TopItemRow[]>([]);

  const load = useCallback(async () => {
    if (preset === "custom" && customStart > customEnd) {
      toast.error("Custom range: start date must be on or before end date.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const forecastEnd = format(startOfDay(new Date()), "yyyy-MM-dd");
    const forecastStart = format(subDays(startOfDay(new Date()), 55), "yyyy-MM-dd");
    const forecastTopStart = format(subDays(startOfDay(new Date()), 29), "yyyy-MM-dd");

    const [
      revRes,
      topRes,
      statusRes,
      heatRes,
      dailyRes,
      topForecastRes,
    ] = await Promise.all([
      supabase.rpc("get_revenue_by_day", {
        p_canteen_id: canteenId,
        p_start_date: rangeStart,
        p_end_date: rangeEnd,
      }),
      supabase.rpc("get_top_items", {
        p_canteen_id: canteenId,
        p_start_date: rangeStart,
        p_end_date: rangeEnd,
        p_limit: 5,
      }),
      supabase.rpc("get_orders_by_status", {
        p_canteen_id: canteenId,
        p_date: statusToday,
      }),
      supabase.rpc("get_hourly_weekday_distribution", {
        p_canteen_id: canteenId,
        p_start_date: rangeStart,
        p_end_date: rangeEnd,
      }),
      supabase.rpc("get_daily_item_sales", {
        p_canteen_id: canteenId,
        p_start_date: forecastStart,
        p_end_date: forecastEnd,
      }),
      supabase.rpc("get_top_items", {
        p_canteen_id: canteenId,
        p_start_date: forecastTopStart,
        p_end_date: forecastEnd,
        p_limit: 20,
      }),
    ]);

    const err =
      revRes.error?.message ||
      topRes.error?.message ||
      statusRes.error?.message ||
      heatRes.error?.message ||
      dailyRes.error?.message ||
      topForecastRes.error?.message;

    if (err) {
      toast.error(err);
      setLoading(false);
      return;
    }

    const revRaw = (revRes.data ?? []) as Record<string, unknown>[];
    setRevenue(
      revRaw.map((r) => ({
        day: String(r.day),
        revenue: Number(r.revenue),
        order_count: Number(r.order_count),
      })),
    );

    const topRaw = (topRes.data ?? []) as Record<string, unknown>[];
    setTopItems(
      topRaw.map((r) => ({
        menu_item_id: String(r.menu_item_id),
        item_name: String(r.item_name),
        quantity_sold: Number(r.quantity_sold),
        revenue: Number(r.revenue),
      })),
    );

    const stRaw = (statusRes.data ?? []) as Record<string, unknown>[];
    setStatusRows(
      stRaw.map((r) => ({
        status: String(r.status),
        count: Number(r.count),
      })),
    );

    const hRaw = (heatRes.data ?? []) as Record<string, unknown>[];
    setHeatmapRows(
      hRaw.map((r) => ({
        dow: Number(r.dow),
        hour: Number(r.hour),
        order_count: Number(r.order_count),
      })),
    );

    const dRaw = (dailyRes.data ?? []) as Record<string, unknown>[];
    setDailySales(
      dRaw.map((r) => ({
        sale_date: String(r.sale_date),
        menu_item_id: String(r.menu_item_id),
        item_name: String(r.item_name),
        quantity_sold: Number(r.quantity_sold),
      })),
    );

    const tfRaw = (topForecastRes.data ?? []) as Record<string, unknown>[];
    setTopForForecast(
      tfRaw.map((r) => ({
        menu_item_id: String(r.menu_item_id),
        item_name: String(r.item_name),
        quantity_sold: Number(r.quantity_sold),
        revenue: Number(r.revenue),
      })),
    );

    setLoading(false);
  }, [canteenId, rangeStart, rangeEnd, statusToday, preset, customStart, customEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const revenueFilled = useMemo(
    () => fillRevenueGaps(revenue, rangeStart, rangeEnd),
    [revenue, rangeStart, rangeEnd],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Date range
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["today", "Today"],
                ["7d", "Last 7 days"],
                ["30d", "Last 30 days"],
                ["custom", "Custom"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPreset(key)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  preset === key
                    ? "text-white"
                    : "border border-muted/25 bg-background text-text hover:border-muted/40"
                }`}
                style={
                  preset === key
                    ? { backgroundColor: primaryColor }
                    : undefined
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {preset === "custom" ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-text">
              <span className="text-muted">From</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="mt-1 block rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-text">
              <span className="text-muted">To</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="mt-1 block rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-muted/30 px-4 py-2 text-sm font-medium text-text hover:bg-muted/10"
            >
              Apply
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted">
            {rangeStart === rangeEnd ? rangeStart : `${rangeStart} → ${rangeEnd}`}
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading analytics…</p>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <RevenueChart data={revenueFilled} primaryColor={primaryColor} />
            <TopItemsChart data={topItems} primaryColor={primaryColor} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <OrderStatusPie data={statusRows} />
            <HourlyHeatmap data={heatmapRows} />
          </div>

          <DemandForecast dailySales={dailySales} topItems={topForForecast} />
        </>
      )}
    </div>
  );
}
