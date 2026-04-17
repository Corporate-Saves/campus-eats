import { Skeleton } from "@/components/ui/Skeleton";

function ColumnShell({ titleWidth }: { titleWidth: string }) {
  return (
    <section className="flex min-h-[min(70vh,520px)] flex-col rounded-2xl border border-muted/20 bg-background/80 p-3 shadow-inner sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-muted/15 pb-2">
        <div className={titleWidth}>
          <Skeleton variant="text" lines={1} />
        </div>
        <Skeleton variant="button" className="h-7 w-10 shrink-0 rounded-full" />
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <div className="rounded-xl border border-muted/15 bg-surface p-3 shadow-sm">
          <Skeleton variant="text" lines={2} className="mb-2" />
          <Skeleton variant="text" lines={1} className="max-w-[60%]" />
          <div className="mt-3 flex gap-2">
            <Skeleton variant="button" className="h-9 flex-1" />
            <Skeleton variant="button" className="h-9 flex-1" />
          </div>
        </div>
        <div className="rounded-xl border border-muted/15 bg-surface p-3 shadow-sm">
          <Skeleton variant="text" lines={2} />
          <div className="mt-3 flex gap-2">
            <Skeleton variant="button" className="h-9 flex-1" />
            <Skeleton variant="button" className="h-9 flex-1" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function StaffQueueLoading() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ColumnShell titleWidth="max-w-[120px]" />
      <ColumnShell titleWidth="max-w-[100px]" />
      <ColumnShell titleWidth="max-w-[160px]" />
    </div>
  );
}
