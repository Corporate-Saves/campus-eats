import { computeCancelClosesAtIsoUtc } from "@/lib/orders/cancel-window";
import type { OrderStatus, OrderTrackerInitial } from "@/types/order-tracking";

function slotStartTime(join: unknown): string | null {
  if (join == null) return null;
  if (Array.isArray(join)) {
    const row = join[0];
    if (row && typeof row === "object" && "start_time" in row) {
      const st = (row as { start_time: unknown }).start_time;
      return typeof st === "string" ? st : null;
    }
    return null;
  }
  if (typeof join === "object" && "start_time" in join) {
    const st = (join as { start_time: unknown }).start_time;
    return typeof st === "string" ? st : null;
  }
  return null;
}

export function toOrderTrackerInitial(row: {
  id: string;
  status: string;
  token_number: number | null;
  total_amount: number | string;
  payment_method: string | null;
  payment_status: string | null;
  special_instructions: string | null;
  scheduled_for: string | null;
  created_at: string;
  accepted_at?: string | null;
  preparing_at?: string | null;
  ready_at?: string | null;
  collected_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  time_slot_id: string | null;
  time_slots?: unknown;
}): OrderTrackerInitial {
  const st = slotStartTime(row.time_slots);
  const cancel_closes_at = computeCancelClosesAtIsoUtc({
    hasSlot: row.time_slot_id != null,
    scheduledFor: row.scheduled_for,
    slotStartTime: st,
  });

  const status = row.status as OrderStatus;

  return {
    id: row.id,
    status:
      status === "PENDING" ||
      status === "ACCEPTED" ||
      status === "PREPARING" ||
      status === "READY" ||
      status === "COLLECTED" ||
      status === "CANCELLED"
        ? status
        : "PENDING",
    token_number: row.token_number,
    total_amount:
      typeof row.total_amount === "string"
        ? parseFloat(row.total_amount)
        : row.total_amount,
    payment_method: row.payment_method,
    payment_status: row.payment_status,
    special_instructions: row.special_instructions,
    scheduled_for: row.scheduled_for,
    created_at: row.created_at,
    accepted_at: row.accepted_at ?? null,
    preparing_at: row.preparing_at ?? null,
    ready_at: row.ready_at ?? null,
    collected_at: row.collected_at ?? null,
    cancelled_at: row.cancelled_at ?? null,
    cancellation_reason: row.cancellation_reason ?? null,
    cancel_closes_at,
  };
}
