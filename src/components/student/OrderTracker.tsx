"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  Bell,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Loader2,
  PackageCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useProfile } from "@/hooks/useProfile";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type {
  OrderStatus,
  OrderTrackerInitial,
  OrderTrackerLineItem,
} from "@/types/order-tracking";

const PROGRESS_STATUSES: Exclude<OrderStatus, "CANCELLED">[] = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "COLLECTED",
];

const STEP_META: Record<
  Exclude<OrderStatus, "CANCELLED">,
  { label: string; icon: typeof ClipboardList }
> = {
  PENDING: { label: "Order placed", icon: ClipboardList },
  ACCEPTED: { label: "Accepted", icon: CheckCircle2 },
  PREPARING: { label: "Preparing", icon: ChefHat },
  READY: { label: "Ready for pickup", icon: Bell },
  COLLECTED: { label: "Collected", icon: PackageCheck },
};

function statusIndex(status: OrderStatus): number {
  if (status === "CANCELLED") return -1;
  return PROGRESS_STATUSES.indexOf(status);
}

function formatTs(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return format(parseISO(iso), "MMM d, h:mm a");
  } catch {
    return null;
  }
}

function stepTimestamp(
  step: Exclude<OrderStatus, "CANCELLED">,
  order: OrderTrackerInitial,
): string | null {
  switch (step) {
    case "PENDING":
      return formatTs(order.created_at);
    case "ACCEPTED":
      return formatTs(order.accepted_at);
    case "PREPARING":
      return formatTs(order.preparing_at);
    case "READY":
      return formatTs(order.ready_at);
    case "COLLECTED":
      return formatTs(order.collected_at);
    default:
      return null;
  }
}

function coerceOrderStatus(s: string): OrderStatus {
  if (
    s === "PENDING" ||
    s === "ACCEPTED" ||
    s === "PREPARING" ||
    s === "READY" ||
    s === "COLLECTED" ||
    s === "CANCELLED"
  ) {
    return s;
  }
  return "PENDING";
}

export function OrderTracker({
  initialOrder,
  lineItems,
}: {
  initialOrder: OrderTrackerInitial;
  lineItems: OrderTrackerLineItem[];
}) {
  const [order, setOrder] = useState<OrderTrackerInitial>(initialOrder);
  const [cancelling, setCancelling] = useState(false);
  const prevStatusRef = useRef<OrderStatus>(initialOrder.status);
  const { refetch: refetchProfile } = useProfile();

  const mergePayload = useCallback((row: Record<string, unknown>) => {
    setOrder((prev) => ({
      ...prev,
      status: coerceOrderStatus(String(row.status ?? prev.status)),
      token_number:
        row.token_number != null
          ? Number(row.token_number)
          : prev.token_number,
      total_amount:
        row.total_amount != null
          ? Number(row.total_amount)
          : prev.total_amount,
      payment_method:
        row.payment_method != null
          ? String(row.payment_method)
          : prev.payment_method,
      payment_status:
        row.payment_status != null
          ? String(row.payment_status)
          : prev.payment_status,
      accepted_at:
        row.accepted_at != null ? String(row.accepted_at) : prev.accepted_at,
      preparing_at:
        row.preparing_at != null ? String(row.preparing_at) : prev.preparing_at,
      ready_at: row.ready_at != null ? String(row.ready_at) : prev.ready_at,
      collected_at:
        row.collected_at != null
          ? String(row.collected_at)
          : prev.collected_at,
      cancelled_at:
        row.cancelled_at != null ? String(row.cancelled_at) : prev.cancelled_at,
      cancellation_reason:
        row.cancellation_reason != null
          ? String(row.cancellation_reason)
          : prev.cancellation_reason,
    }));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`order-${initialOrder.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${initialOrder.id}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === "object") {
            mergePayload(payload.new as Record<string, unknown>);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [initialOrder.id, mergePayload]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev !== "READY" && order.status === "READY") {
      if (
        typeof window !== "undefined" &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification("CampusEats", {
          body: `Your order is ready! Token #${order.token_number ?? "—"}`,
        });
      }
    }
    prevStatusRef.current = order.status;
  }, [order.status, order.token_number]);

  const currentIdx = useMemo(() => statusIndex(order.status), [order.status]);

  const withinCancelWindow = useMemo(() => {
    if (!order.cancel_closes_at) return true;
    return Date.now() < new Date(order.cancel_closes_at).getTime();
  }, [order.cancel_closes_at]);

  const showCancel = order.status === "PENDING" && withinCancelWindow;

  const handleCancel = async () => {
    if (!showCancel) return;
    if (!window.confirm("Cancel this order? Your wallet will be refunded.")) {
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        order?: OrderTrackerInitial;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Could not cancel order");
        return;
      }
      if (body.order) {
        setOrder(body.order);
      } else {
        mergePayload({
          status: "CANCELLED",
          payment_status: "refunded",
          cancellation_reason: "Cancelled by student",
        });
      }
      toast.success("Order cancelled. Refund added to your wallet.");
      void refetchProfile();
    } catch {
      toast.error("Network error");
    } finally {
      setCancelling(false);
    }
  };

  if (order.status === "CANCELLED") {
    return (
      <div className="pb-8">
        <h1 className="text-2xl font-bold text-text">Order cancelled</h1>
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">This order was cancelled</p>
          {order.cancellation_reason ? (
            <p className="mt-2 text-red-800">{order.cancellation_reason}</p>
          ) : null}
          <p className="mt-3 font-medium">
            ₹{Number(order.total_amount).toFixed(0)} has been credited back to
            your campus wallet.
          </p>
        </div>

        <OrderSummarySection order={order} lineItems={lineItems} />

        <Link
          href="/student/orders"
          className="mt-6 inline-block text-sm font-medium text-primary underline"
        >
          All orders
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Track order</h1>
          <p className="mt-1 text-sm text-muted">
            Token{" "}
            <span className="font-semibold text-text">
              #{order.token_number ?? "—"}
            </span>
          </p>
        </div>
      </div>

      {order.status === "READY" ? (
        <div
          className="mt-6 rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-4 py-6 text-center shadow-sm"
          role="status"
        >
          <p className="text-lg font-bold text-emerald-900">
            Your order is ready! 🎉
          </p>
          <p className="mt-2 text-5xl font-black tabular-nums text-emerald-800">
            #{order.token_number ?? "—"}
          </p>
          <p className="mt-2 text-sm text-emerald-800">
            Show this token at the counter
          </p>
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Progress
        </h2>
        <ol className="mt-4 space-y-0">
          {PROGRESS_STATUSES.map((step, i) => {
            const done = currentIdx >= i;
            const current = order.status === step;
            const Icon = STEP_META[step].icon;
            const ts = stepTimestamp(step, order);

            return (
              <li key={step} className="relative flex gap-4 pb-8 last:pb-0">
                {i < PROGRESS_STATUSES.length - 1 ? (
                  <div
                    className={cn(
                      "absolute left-[18px] top-10 h-[calc(100%-0.5rem)] w-0.5",
                      done ? "bg-primary" : "bg-muted/30",
                    )}
                    aria-hidden
                  />
                ) : null}
                <div
                  className={cn(
                    "relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-surface",
                    current && "border-primary ring-4 ring-primary/20",
                    done && !current && "border-primary bg-primary/10",
                    !done && "border-muted/40 text-muted",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p
                    className={cn(
                      "font-semibold text-text",
                      !done && "text-muted",
                    )}
                  >
                    {STEP_META[step].label}
                  </p>
                  {ts ? (
                    <p className="mt-0.5 text-xs text-muted">{ts}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <OrderSummarySection order={order} lineItems={lineItems} />

      {showCancel ? (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={cancelling}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 py-3 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-60"
          >
            {cancelling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cancelling…
              </>
            ) : (
              "Cancel order"
            )}
          </button>
          <p className="mt-2 text-center text-xs text-muted">
            {order.cancel_closes_at
              ? `Scheduled orders can be cancelled until ${format(parseISO(order.cancel_closes_at), "MMM d, h:mm a")}.`
              : "You can cancel while the kitchen has not started preparing your order."}
          </p>
        </div>
      ) : null}

      <Link
        href="/student/orders"
        className="mt-8 inline-block text-sm font-medium text-primary underline"
      >
        All orders
      </Link>
    </div>
  );
}

function OrderSummarySection({
  order,
  lineItems,
}: {
  order: OrderTrackerInitial;
  lineItems: OrderTrackerLineItem[];
}) {
  return (
    <>
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted">
        Order summary
      </h2>
      <dl className="mt-3 space-y-2 rounded-xl border border-muted/20 bg-surface p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Total paid</dt>
          <dd className="font-medium text-text">
            ₹{Number(order.total_amount).toFixed(0)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Payment</dt>
          <dd className="capitalize text-text">
            {order.payment_method ?? "—"} ({order.payment_status ?? "—"})
          </dd>
        </div>
        {order.special_instructions ? (
          <div>
            <dt className="text-muted">Instructions</dt>
            <dd className="mt-1 text-text">{order.special_instructions}</dd>
          </div>
        ) : null}
        {order.scheduled_for ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Scheduled</dt>
            <dd className="text-text">{order.scheduled_for}</dd>
          </div>
        ) : null}
      </dl>
      <ul className="mt-3 space-y-2">
        {lineItems.map((line) => (
          <li
            key={line.id}
            className="flex justify-between gap-3 rounded-lg border border-muted/15 bg-background px-3 py-2 text-sm"
          >
            <span>
              {line.displayName}{" "}
              <span className="text-muted">× {line.quantity}</span>
            </span>
            <span className="shrink-0 font-medium">
              ₹{Number(line.subtotal).toFixed(0)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
