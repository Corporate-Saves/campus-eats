import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CartLine = {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
};

type CartState = {
  canteen_id: string | null;
  items: CartLine[];
  addItem: (payload: {
    canteen_id: string;
    menu_item_id: string;
    name: string;
    price: number;
  }) => void;
  removeItem: (menu_item_id: string) => void;
  updateQuantity: (menu_item_id: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
};

function totalFromItems(items: CartLine[]): number {
  return items.reduce((sum, line) => sum + line.price * line.quantity, 0);
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      canteen_id: null,
      items: [],
      addItem: ({ canteen_id, menu_item_id, name, price }) => {
        set((state) => {
          if (
            state.canteen_id != null &&
            state.canteen_id !== canteen_id
          ) {
            const existing = state.items.find((i) => i.menu_item_id === menu_item_id);
            if (existing) {
              return {
                canteen_id,
                items: [{ ...existing, quantity: existing.quantity + 1 }],
              };
            }
            return {
              canteen_id,
              items: [{ menu_item_id, name, price, quantity: 1 }],
            };
          }
          const existing = state.items.find((i) => i.menu_item_id === menu_item_id);
          if (existing) {
            return {
              canteen_id,
              items: state.items.map((i) =>
                i.menu_item_id === menu_item_id
                  ? { ...i, quantity: i.quantity + 1 }
                  : i,
              ),
            };
          }
          return {
            canteen_id,
            items: [
              ...state.items,
              { menu_item_id, name, price, quantity: 1 },
            ],
          };
        });
      },
      removeItem: (menu_item_id) => {
        set((state) => {
          const next = state.items.filter((i) => i.menu_item_id !== menu_item_id);
          return {
            items: next,
            canteen_id: next.length === 0 ? null : state.canteen_id,
          };
        });
      },
      updateQuantity: (menu_item_id, quantity) => {
        if (quantity < 1) {
          get().removeItem(menu_item_id);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.menu_item_id === menu_item_id ? { ...i, quantity } : i,
          ),
        }));
      },
      clearCart: () => set({ items: [], canteen_id: null }),
      getTotal: () => totalFromItems(get().items),
    }),
    {
      name: "campus-eats-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        canteen_id: state.canteen_id,
      }),
    },
  ),
);
