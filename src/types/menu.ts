/** Serializable menu props from server → client. */
export type MenuCategoryDTO = {
  id: string;
  name: string;
  sort_order: number;
};

export type MenuItemDTO = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_veg: boolean;
  is_available: boolean;
  max_daily_quantity: number | null;
  prepared_quantity: number;
  tags: string[] | null;
};
