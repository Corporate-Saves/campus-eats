import { Skeleton } from "@/components/ui/Skeleton";

function ChartBlock() {
  return (
    <div className="rounded-2xl border border-muted/20 bg-surface p-4 shadow-sm">
      <Skeleton variant="text" lines={1} className="mb-4 max-w-[140px]" />
      <div className="relative h-52 overflow-hidden rounded-xl bg-muted/25">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full animate-skeleton-shimmer bg-gradient-to-r from-transparent via-white/45 to-transparent"
        />
      </div>
    </div>
  );
}

export default function OwnerAnalyticsLoading() {
  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton variant="button" className="h-10 w-36" />
        <Skeleton variant="button" className="h-10 w-28" />
        <Skeleton variant="button" className="h-10 w-32" />
      </div>
      <ChartBlock />
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartBlock />
        <ChartBlock />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartBlock />
        <Skeleton variant="card" className="min-h-[200px]" />
      </div>
    </div>
  );
}
