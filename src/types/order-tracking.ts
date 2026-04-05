export type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "COLLECTED"
  | "CANCELLED";

export type OrderTrackerLineItem = {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  displayName: string;
};

/** Serializable order snapshot for SSR + realtime client */
export type OrderTrackerInitial = {
  id: string;
  status: OrderStatus;
  token_number: number | null;
  total_amount: number;
  payment_method: string | null;
  payment_status: string | null;
  special_instructions: string | null;
  scheduled_for: string | null;
  created_at: string;
  accepted_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  collected_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  /** First instant (UTC) when student-initiated cancel is no longer allowed; null = no slot window */
  cancel_closes_at: string | null;
};
