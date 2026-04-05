"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapRowToStaffQueueOrder, STAFF_QUEUE_ORDER_SELECT } from "@/lib/staff/map-queue-order";
import { playStaffQueueBeep } from "@/lib/sounds/staff-queue-beep";
import type { StaffQueueOrder } from "@/types/staff-queue";
import { OrderCard } from "./OrderCard";

function partition(orders: StaffQueueOrder[]) {
  return {
    newOrders: orders.filter(
      (o) => o.status === "PENDING" || o.status === "ACCEPTED",
    ),
    preparing: orders.filter((o) => o.status === "PREPARING"),
    ready: orders.filter((o) => o.status === "READY"),
  };
}

function Column({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-[min(70vh,520px)] flex-col rounded-2xl border border-muted/20 bg-background/80 p-3 shadow-inner sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-muted/15 pb-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-text sm:text-base">
          {title}
        </h2>
        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary tabular-nums">
          {count}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5">
        {children}
      </div>
    </section>
  );
}

export function OrderQueueBoard({
  canteenId,
  scheduledFor,
}: {
  canteenId: string;
  scheduledFor: string;
}) {
  const [orders, setOrders] = useState<StaffQueueOrder[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulseIds, setPulseIds] = useState<Set<string>>(new Set());
  const [enterIds, setEnterIds] = useState<Set<string>>(new Set());

  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialSyncDoneRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);
  const animationTimerIdsRef = useRef<Set<number>>(new Set());

  const loadOrders = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("orders")
      .select(STAFF_QUEUE_ORDER_SELECT)
      .eq("canteen_id", canteenId)
      .eq("scheduled_for", scheduledFor)
      .in("status", ["PENDING", "ACCEPTED", "PREPARING", "READY"])
      .order("created_at", { ascending: true });

    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    const mapped = (data ?? []).map((row) =>
      mapRowToStaffQueueOrder(row as Parameters<typeof mapRowToStaffQueueOrder>[0]),
    );

    if (!initialSyncDoneRef.current) {
      mapped.forEach((o) => seenIdsRef.current.add(o.id));
      initialSyncDoneRef.current = true;
      setOrders(mapped);
      setLoadError(null);
      setLoading(false);
      return;
    }

    const newlySeen = mapped.filter((o) => !seenIdsRef.current.has(o.id));
    const newInNewColumn = newlySeen.filter(
      (o) => o.status === "PENDING" || o.status === "ACCEPTED",
    );

    if (newInNewColumn.length > 0) {
      playStaffQueueBeep();
      const ids = newInNewColumn.map((o) => o.id);
      setPulseIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      setEnterIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      const animationTid = window.setTimeout(() => {
        animationTimerIdsRef.current.delete(animationTid);
        setPulseIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        setEnterIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }, 2800);
      animationTimerIdsRef.current.add(animationTid);
    }

    mapped.forEach((o) => seenIdsRef.current.add(o.id));
    setOrders(mapped);
    setLoadError(null);
    setLoading(false);
  }, [canteenId, scheduledFor]);

  const scheduleRefetch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void loadOrders();
    }, 140);
  }, [loadOrders]);

  useEffect(() => {
    const pendingAnimationTimers = animationTimerIdsRef.current;
    seenIdsRef.current = new Set();
    initialSyncDoneRef.current = false;
    return () => {
      pendingAnimationTimers.forEach((id) => clearTimeout(id));
      pendingAnimationTimers.clear();
    };
  }, [canteenId, scheduledFor]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`staff-queue-${canteenId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `canteen_id=eq.${canteenId}`,
        },
        (payload) => {
          const n = payload.new as { scheduled_for?: string } | undefined;
          const o = payload.old as { scheduled_for?: string } | undefined;
          if (payload.eventType === "INSERT") {
            if (n?.scheduled_for !== scheduledFor) return;
          } else if (payload.eventType === "UPDATE") {
            if (n?.scheduled_for !== scheduledFor && o?.scheduled_for !== scheduledFor) {
              return;
            }
          } else if (payload.eventType === "DELETE") {
            if (o?.scheduled_for !== scheduledFor) return;
          }
          scheduleRefetch();
        },
      )
      .subscribe();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [canteenId, scheduledFor, scheduleRefetch]);

  const { newOrders, preparing, ready } = partition(orders);

  if (loading && orders.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted">Loading queue…</p>
    );
  }

  if (loadError) {
    return (
      <p className="py-12 text-center text-sm text-red-600">{loadError}</p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Column title="New Orders" count={newOrders.length}>
        {newOrders.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No new orders</p>
        ) : (
          newOrders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              highlight={pulseIds.has(o.id)}
              isEntering={enterIds.has(o.id)}
              onStatusChanged={() => void loadOrders()}
            />
          ))
        )}
      </Column>
      <Column title="Preparing" count={preparing.length}>
        {preparing.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Kitchen clear</p>
        ) : (
          preparing.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              highlight={false}
              isEntering={false}
              onStatusChanged={() => void loadOrders()}
            />
          ))
        )}
      </Column>
      <Column title="Ready for Pickup" count={ready.length}>
        {ready.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nothing waiting</p>
        ) : (
          ready.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              highlight={false}
              isEntering={false}
              onStatusChanged={() => void loadOrders()}
            />
          ))
        )}
      </Column>
    </div>
  );
}
