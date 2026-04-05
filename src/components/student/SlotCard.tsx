"use client";

import { cn } from "@/lib/utils";

export type SlotCardProps = {
  label: string;
  filled: number;
  max: number;
  selected: boolean;
  disabled: boolean;
  isFull: boolean;
  primaryColor: string;
  onSelect: () => void;
};

export function SlotCard({
  label,
  filled,
  max,
  selected,
  disabled,
  isFull,
  primaryColor,
  onSelect,
}: SlotCardProps) {
  const ratio = max > 0 ? Math.min(1, filled / max) : 0;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border-2 bg-surface p-4 text-left transition",
        "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        disabled && "cursor-not-allowed opacity-60",
        selected && !disabled && "shadow-md",
        !selected && !disabled && "border-muted/25 hover:border-muted/50",
      )}
      style={
        selected && !disabled
          ? {
              borderColor: primaryColor,
              boxShadow: `0 0 0 1px ${primaryColor}40`,
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-text">{label}</span>
        {isFull ? (
          <span className="shrink-0 rounded-full bg-muted/30 px-2 py-0.5 text-xs font-medium text-muted">
            Full
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>Capacity</span>
          <span>
            {filled} / {max} slots filled
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${ratio * 100}%`,
              backgroundColor: isFull ? "#94a3b8" : primaryColor,
            }}
          />
        </div>
      </div>
    </button>
  );
}
