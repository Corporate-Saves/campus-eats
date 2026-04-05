/** Menu item row for staff availability UI (server → client). */
export type StaffAvailabilityItem = {
  id: string;
  category_id: string;
  name: string;
  price: number;
  is_available: boolean;
  max_daily_quantity: number | null;
  prepared_quantity: number;
};
