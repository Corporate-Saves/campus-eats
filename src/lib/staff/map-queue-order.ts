import type { StaffQueueLineItem, StaffQueueOrder, StaffQueueOrderStatus } from "@/types/staff-queue";

function coerceStatus(s: string): StaffQueueOrderStatus {
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

type SlotJoin = { label: string | null; start_time: string | null; end_time: string | null } | null;
type ProfileJoin = { full_name: string | null } | null;
type RawLine = {
  id: string;
  quantity: number;
  menu_items: { name: string } | { name: string }[] | null;
};

export function mapRowToStaffQueueOrder(row: {
  id: string;
  status: string;
  token_number: number | null;
  total_amount: number | string;
  special_instructions: string | null;
  scheduled_for: string | null;
  created_at: string;
  student_id: string;
  profiles?: ProfileJoin | ProfileJoin[];
  time_slots?: SlotJoin | SlotJoin[];
  order_items?: RawLine[] | null;
}): StaffQueueOrder {
  const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const slot = Array.isArray(row.time_slots) ? row.time_slots[0] : row.time_slots;
  const slotLabel =
    slot?.label?.trim() ||
    [slot?.start_time, slot?.end_time].filter(Boolean).join(" – ") ||
    null;

  const items: StaffQueueLineItem[] = (row.order_items ?? []).map((line) => {
    const mi = line.menu_items;
    const name =
      mi == null
        ? "Item"
        : Array.isArray(mi)
          ? mi[0]?.name ?? "Item"
          : mi.name;
    return {
      id: line.id,
      quantity: line.quantity,
      displayName: name,
    };
  });

  return {
    id: row.id,
    status: coerceStatus(row.status),
    token_number: row.token_number,
    total_amount:
      typeof row.total_amount === "string"
        ? parseFloat(row.total_amount)
        : row.total_amount,
    special_instructions: row.special_instructions,
    scheduled_for: row.scheduled_for,
    created_at: row.created_at,
    student_id: row.student_id,
    student_name: prof?.full_name?.trim() || "Student",
    slot_label: slotLabel,
    items,
  };
}

export const STAFF_QUEUE_ORDER_SELECT = `
  id,
  status,
  token_number,
  total_amount,
  special_instructions,
  scheduled_for,
  created_at,
  student_id,
  profiles ( full_name ),
  time_slots ( label, start_time, end_time ),
  order_items (
    id,
    quantity,
    menu_items ( name )
  )
` as const;
