import type { MenuCategoryDTO } from "@/types/menu";

export const OWNER_MENU_TAGS = [
  "spicy",
  "bestseller",
  "new",
  "healthy",
] as const;

export type OwnerMenuTag = (typeof OWNER_MENU_TAGS)[number];

export type OwnerMenuItemDTO = {
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
  deleted_at: string | null;
};

export type OwnerMenuPayload = {
  categories: MenuCategoryDTO[];
  items: OwnerMenuItemDTO[];
  canteenId: string;
};
