"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const READY_MAX = 6;

type OrderRow = {
  id: string;
  token_number: number | null;
  status: string;
  ready_at: string | null;
  created_at: string;
};

type DisplayRow = {
  id: string;
  token: number;
  status: "PREPARING" | "READY";
  readyAt: string | null;
  flyIn: boolean;
  pulse: boolean;
  fadeOut: boolean;
};

function formatToken(n: number) {
  if (n <= 0) return "—";
  return String(n).padStart(3, "0");
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

export function TvTokenDisplay({ canteenId }: { canteenId: string }) {
  const [canteenName, setCanteenName] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [rows, setRows] = useState<Map<string, DisplayRow>>(new Map());
  const flyTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pulseTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const fadeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = (
    map: { current: Map<string, ReturnType<typeof setTimeout>> },
    id: string,
  ) => {
    const t = map.current.get(id);
    if (t) {
      clearTimeout(t);
      map.current.delete(id);
    }
  };

  const removeRow = useCallback((id: string) => {
    clearTimer(flyTimers, id);
    clearTimer(pulseTimers, id);
    clearTimer(fadeTimers, id);
    setRows((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const applyRealtimeRecord = useCallback(
    (record: OrderRow | null, oldRecord: OrderRow | null) => {
      if (!record?.id) return;

      const id = record.id;
      const nextStatus = record.status;

      if (nextStatus !== "PREPARING" && nextStatus !== "READY") {
        setRows((prev) => {
          const existing = prev.get(id);
          const wasReady =
            oldRecord?.status === "READY" || existing?.status === "READY";
          if (wasReady && existing) {
            const next = new Map(prev);
            next.set(id, { ...existing, fadeOut: true });
            clearTimer(fadeTimers, id);
            fadeTimers.current.set(
              id,
              setTimeout(() => removeRow(id), 560),
            );
            return next;
          }
          clearTimer(flyTimers, id);
          clearTimer(pulseTimers, id);
          clearTimer(fadeTimers, id);
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        return;
      }

      const token = record.token_number ?? 0;

      setRows((prev) => {
        const existing = prev.get(id);
        const prevEff =
          (oldRecord?.status as string | undefined) ?? existing?.status;
        const becameReady =
          nextStatus === "READY" &&
          prevEff !== "READY" &&
          (prevEff == null ||
            prevEff === "PREPARING" ||
            prevEff === "PENDING" ||
            prevEff === "ACCEPTED");

        const next = new Map(prev);
        next.set(id, {
          id,
          token,
          status: nextStatus as "PREPARING" | "READY",
          readyAt: record.ready_at,
          flyIn: becameReady,
          pulse: becameReady,
          fadeOut: false,
        });

        if (becameReady) {
          clearTimer(flyTimers, id);
          flyTimers.current.set(
            id,
            setTimeout(() => {
              setRows((p) => {
                const cur = p.get(id);
                if (!cur) return p;
                const m = new Map(p);
                m.set(id, { ...cur, flyIn: false });
                return m;
              });
              flyTimers.current.delete(id);
            }, 900),
          );

          clearTimer(pulseTimers, id);
          pulseTimers.current.set(
            id,
            setTimeout(() => {
              setRows((p) => {
                const cur = p.get(id);
                if (!cur) return p;
                const m = new Map(p);
                m.set(id, { ...cur, pulse: false });
                return m;
              });
              pulseTimers.current.delete(id);
            }, 3800),
          );
        }

        return next;
      });
    },
    [removeRow],
  );

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(
      () => window.location.reload(),
      30 * 60 * 1000,
    );
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isUuid(canteenId)) {
      setLoadError("Invalid display link.");
      return;
    }

    const supabase = createClient();
    const channelRef: {
      current: ReturnType<typeof supabase.channel> | null;
    } = { current: null };
    let cancelled = false;

    void (async () => {
      const { data: canteen, error: cErr } = await supabase
        .from("canteens")
        .select("name")
        .eq("id", canteenId)
        .maybeSingle();

      if (cancelled) return;
      if (cErr || !canteen?.name) {
        setLoadError("This display is not available.");
        return;
      }
      setCanteenName(canteen.name);

      const { data: orders, error: oErr } = await supabase
        .from("orders")
        .select("id, token_number, status, ready_at, created_at")
        .eq("canteen_id", canteenId)
        .in("status", ["PREPARING", "READY"]);

      if (cancelled) return;
      if (oErr) {
        setLoadError(oErr.message);
        return;
      }

      const initial = new Map<string, DisplayRow>();
      for (const r of orders ?? []) {
        const row = r as OrderRow;
        if (row.status !== "PREPARING" && row.status !== "READY") continue;
        initial.set(row.id, {
          id: row.id,
          token: row.token_number ?? 0,
          status: row.status as "PREPARING" | "READY",
          readyAt: row.ready_at,
          flyIn: false,
          pulse: false,
          fadeOut: false,
        });
      }
      setRows(initial);

      const ch = supabase
        .channel(`tv-board:${canteenId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `canteen_id=eq.${canteenId}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              applyRealtimeRecord(payload.new as OrderRow, null);
              return;
            }
            if (payload.eventType === "UPDATE") {
              applyRealtimeRecord(
                payload.new as OrderRow,
                payload.old as OrderRow,
              );
              return;
            }
            if (payload.eventType === "DELETE") {
              removeRow((payload.old as { id: string }).id);
            }
          },
        )
        .subscribe();

      if (cancelled) {
        void supabase.removeChannel(ch);
        return;
      }
      channelRef.current = ch;
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      /* Ref-backed timer maps: read .current when cleanup runs. */
      /* eslint-disable react-hooks/exhaustive-deps */
      const flyM = flyTimers.current;
      const pulseM = pulseTimers.current;
      const fadeM = fadeTimers.current;
      /* eslint-enable react-hooks/exhaustive-deps */
      for (const t of flyM.values()) clearTimeout(t);
      for (const t of pulseM.values()) clearTimeout(t);
      for (const t of fadeM.values()) clearTimeout(t);
      flyM.clear();
      pulseM.clear();
      fadeM.clear();
    };
  }, [canteenId, applyRealtimeRecord, removeRow]);

  const preparingList = useMemo(() => {
    return [...rows.values()]
      .filter((r) => r.status === "PREPARING" && !r.fadeOut)
      .sort((a, b) => a.token - b.token);
  }, [rows]);

  const readyList = useMemo(() => {
    return [...rows.values()]
      .filter((r) => r.status === "READY")
      .sort((a, b) => {
        const ta = a.readyAt ? new Date(a.readyAt).getTime() : 0;
        const tb = b.readyAt ? new Date(b.readyAt).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return b.token - a.token;
      })
      .slice(0, READY_MAX);
  }, [rows]);

  const timeStr = clock.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  if (loadError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black px-6 text-center text-2xl font-medium text-white">
        {loadError}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#050508] text-white">
      <header className="flex shrink-0 items-start justify-between gap-6 border-b border-white/10 px-8 py-6 sm:px-12 sm:py-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            {canteenName || "…"}
          </h1>
          <p className="mt-2 text-lg text-white/55 sm:text-xl">
            Pickup tokens · today
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl md:text-6xl">
            {timeStr}
          </p>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 p-6 md:grid-cols-2 md:gap-10 md:p-10 lg:p-14">
        <section className="flex min-h-0 flex-col rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.06] p-6 md:p-8">
          <h2 className="mb-6 text-2xl font-bold uppercase tracking-[0.2em] text-emerald-300/90 md:text-3xl">
            Now ready
          </h2>
          <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-4 sm:gap-5 lg:grid-cols-3">
            {readyList.length === 0 ? (
              <p className="col-span-full text-xl text-white/40 md:text-2xl">
                Waiting for orders…
              </p>
            ) : (
              readyList.map((r) => (
                <div
                  key={r.id}
                  className={[
                    "flex aspect-[4/3] items-center justify-center rounded-2xl border-2 border-white/20 bg-white/[0.07] font-bold tabular-nums text-white shadow-lg",
                    r.flyIn ? "tv-token-fly-in" : "",
                    r.pulse ? "tv-token-pulse" : "",
                    r.fadeOut ? "tv-token-fade-out" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    fontSize: "clamp(5rem, 12vw, 9rem)",
                    lineHeight: 1,
                  }}
                >
                  {formatToken(r.token)}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-3xl border border-amber-500/20 bg-amber-500/[0.05] p-6 md:p-8">
          <h2 className="mb-5 text-xl font-bold uppercase tracking-[0.25em] text-amber-200/85 md:text-2xl">
            Preparing
          </h2>
          <ul className="flex flex-col gap-3 overflow-y-auto pr-1">
            {preparingList.length === 0 ? (
              <li className="text-lg text-white/35 md:text-xl">No orders in kitchen</li>
            ) : (
              preparingList.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-5 py-4 md:px-6 md:py-5"
                >
                  <span className="text-3xl font-semibold tabular-nums md:text-4xl lg:text-5xl">
                    #{formatToken(r.token)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
