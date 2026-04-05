"use client";

import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";

type CartDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const subtotal = useMemo(
    () => items.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [items],
  );

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-text/40 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-[70] flex max-h-[85vh] flex-col rounded-t-2xl border border-muted/20 bg-surface shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
      >
        <div className="flex items-center justify-between border-b border-muted/15 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-text">Your cart</h2>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-muted hover:bg-background hover:text-text"
            onClick={() => onOpenChange(false)}
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {!mounted || items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Your cart is empty.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((line) => (
                <li
                  key={line.menu_item_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-muted/15 bg-background px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text">{line.name}</p>
                    <p className="text-xs text-muted">
                      ₹{line.price.toFixed(0)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-muted/30 p-1.5 text-text hover:bg-surface"
                      onClick={() =>
                        updateQuantity(line.menu_item_id, line.quantity - 1)
                      }
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg border border-muted/30 p-1.5 text-text hover:bg-surface"
                      onClick={() =>
                        updateQuantity(line.menu_item_id, line.quantity + 1)
                      }
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="ml-1 text-xs text-muted underline"
                      onClick={() => removeItem(line.menu_item_id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-muted/15 bg-background px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-muted">Subtotal</span>
            <span className="text-lg font-bold text-text">
              ₹{subtotal.toFixed(0)}
            </span>
          </div>
          <button
            type="button"
            disabled={!mounted || items.length === 0}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              onOpenChange(false);
              router.push("/student/checkout");
            }}
          >
            Proceed to Order
          </button>
        </div>
      </div>
    </>
  );
}
