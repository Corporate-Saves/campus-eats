import { cn } from "@/lib/utils";

const shimmerBar =
  "pointer-events-none absolute inset-0 -translate-x-full animate-skeleton-shimmer bg-gradient-to-r from-transparent via-white/55 to-transparent";

export type SkeletonVariant = "text" | "card" | "avatar" | "button";

type SkeletonProps = {
  className?: string;
  variant?: SkeletonVariant;
  /** Number of lines when variant is `text` */
  lines?: number;
};

export function Skeleton({
  className,
  variant = "card",
  lines = 3,
}: SkeletonProps) {
  if (variant === "text") {
    return (
      <div className={cn("flex w-full flex-col gap-2", className)} aria-hidden>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "relative h-3.5 overflow-hidden rounded-md bg-muted/35",
              i === lines - 1 ? "max-w-[60%]" : "w-full",
            )}
          >
            <span className={shimmerBar} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "avatar") {
    return (
      <div
        className={cn(
          "relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted/35",
          className,
        )}
        aria-hidden
      >
        <span className={shimmerBar} />
      </div>
    );
  }

  if (variant === "button") {
    return (
      <div
        className={cn(
          "relative h-10 w-28 overflow-hidden rounded-lg bg-muted/35",
          className,
        )}
        aria-hidden
      >
        <span className={shimmerBar} />
      </div>
    );
  }

  /* card */
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-muted/15 bg-surface p-3 shadow-sm",
        className,
      )}
      aria-hidden
    >
      <div className="flex gap-3">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted/35">
          <span className={shimmerBar} />
        </div>
        <div className="min-w-0 flex-1 space-y-2 py-0.5">
          <div className="relative h-4 max-w-[85%] overflow-hidden rounded-md bg-muted/35">
            <span className={shimmerBar} />
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-md bg-muted/30">
            <span className={shimmerBar} />
          </div>
          <div className="relative h-3 w-2/3 overflow-hidden rounded-md bg-muted/30">
            <span className={shimmerBar} />
          </div>
          <div className="relative mt-3 h-9 w-full overflow-hidden rounded-lg bg-muted/40">
            <span className={shimmerBar} />
          </div>
        </div>
      </div>
    </div>
  );
}
