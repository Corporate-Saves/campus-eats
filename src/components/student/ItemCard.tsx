"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";

export type ItemCardProps = {
  canteenId: string;
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_veg: boolean;
  is_available: boolean;
  tags: string[] | null;
  max_daily_quantity: number | null;
  prepared_quantity: number;
};

function isSoldOut(
  maxDaily: number | null,
  prepared: number,
  available: boolean,
) {
  if (!available) return true;
  if (maxDaily == null) return false;
  return prepared >= maxDaily;
}

function hasBestsellerTag(tags: string[] | null) {
  return tags?.some((t) => t.toLowerCase() === "bestseller") ?? false;
}

export function ItemCard({
  canteenId,
  id,
  name,
  description,
  price,
  image_url,
  is_veg,
  is_available,
  tags,
  max_daily_quantity,
  prepared_quantity,
}: ItemCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const [bounce, setBounce] = useState(false);
  const bounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (bounceTimeoutRef.current != null) {
        clearTimeout(bounceTimeoutRef.current);
        bounceTimeoutRef.current = null;
      }
    };
  }, []);

  const soldOut = isSoldOut(
    max_daily_quantity,
    prepared_quantity,
    is_available,
  );
  const bestseller = hasBestsellerTag(tags);

  const handleAdd = () => {
    if (soldOut || !canteenId) return;
    if (bounceTimeoutRef.current != null) {
      clearTimeout(bounceTimeoutRef.current);
    }
    setBounce(true);
    bounceTimeoutRef.current = setTimeout(() => {
      bounceTimeoutRef.current = null;
      setBounce(false);
    }, 220);
    addItem({ canteen_id: canteenId, menu_item_id: id, name, price });
    toast.success("Added to cart", { duration: 1400 });
  };

  return (
    <article className="overflow-hidden rounded-xl border border-muted/20 bg-surface shadow-sm">
      <div className="flex gap-3 p-3">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-background">
          {image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted">
              No image
            </div>
          )}
          {soldOut ? (
            <span className="absolute inset-0 flex items-center justify-center bg-text/60 text-xs font-semibold text-white">
              Sold Out
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-snug text-text">{name}</h3>
            <span
              className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-surface"
              style={{
                backgroundColor: is_veg ? "#22c55e" : "#ef4444",
                boxShadow: is_veg
                  ? "0 0 0 2px rgba(34,197,94,0.35)"
                  : "0 0 0 2px rgba(239,68,68,0.35)",
              }}
              title={is_veg ? "Vegetarian" : "Non-vegetarian"}
              aria-label={is_veg ? "Vegetarian" : "Non-vegetarian"}
            />
          </div>
          {description ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted">{description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-text">
              ₹{price.toFixed(0)}
            </span>
            {bestseller ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Bestseller
              </span>
            ) : null}
          </div>
          <button
            type="button"
            disabled={soldOut}
            onClick={handleAdd}
            className={cn(
              "mt-3 w-full rounded-lg py-2 text-sm font-semibold text-white transition-transform duration-200 ease-out",
              "bg-primary hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40",
              bounce && "scale-95",
            )}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
}
