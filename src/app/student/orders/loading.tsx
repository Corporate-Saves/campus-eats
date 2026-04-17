import { Skeleton } from "@/components/ui/Skeleton";

function OrderRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-muted/15 bg-surface px-4 py-4 shadow-sm">
      <Skeleton variant="avatar" className="h-11 w-11 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton variant="text" lines={2} className="gap-1.5" />
      </div>
      <Skeleton variant="button" className="h-8 w-20 shrink-0" />
    </div>
  );
}

export default function StudentOrdersLoading() {
  return (
    <div className="space-y-4 pb-10">
      <Skeleton variant="text" lines={1} className="max-w-[160px]" />
      <div className="space-y-3">
        <OrderRowSkeleton />
        <OrderRowSkeleton />
        <OrderRowSkeleton />
      </div>
    </div>
  );
}
