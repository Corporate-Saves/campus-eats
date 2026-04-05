export type StaffQueueOrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "COLLECTED"
  | "CANCELLED";

export type StaffQueueLineItem = {
  id: string;
  quantity: number;
  displayName: string;
};

export type StaffQueueOrder = {
  id: string;
  status: StaffQueueOrderStatus;
  token_number: number | null;
  total_amount: number;
  special_instructions: string | null;
  scheduled_for: string | null;
  created_at: string;
  student_id: string;
  student_name: string;
  slot_label: string | null;
  items: StaffQueueLineItem[];
};
