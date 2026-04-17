import { Skeleton } from "@/components/ui/Skeleton";

export default function StudentMenuLoading() {
  return (
    <div className="space-y-6 pb-10">
      <div className="space-y-2">
        <Skeleton variant="text" lines={1} className="max-w-[200px]" />
        <Skeleton variant="text" lines={1} className="max-w-[280px]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>
    </div>
  );
}
