export type RevenueByDayRow = {
  day: string;
  revenue: number;
  order_count: number;
};

export type TopItemRow = {
  menu_item_id: string;
  item_name: string;
  quantity_sold: number;
  revenue: number;
};

export type OrderStatusRow = {
  status: string;
  count: number;
};

export type HourlyRow = {
  hour: number;
  order_count: number;
};

export type HourlyWeekdayRow = {
  dow: number;
  hour: number;
  order_count: number;
};

export type DailyItemSaleRow = {
  sale_date: string;
  menu_item_id: string;
  item_name: string;
  quantity_sold: number;
};
