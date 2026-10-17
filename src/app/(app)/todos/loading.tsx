import { Skeleton, SkeletonPage } from "@/components/common/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <Skeleton className="mb-5 h-9 w-32" />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid gap-3 rounded-2xl border p-3">
        <Skeleton className="h-12" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    </SkeletonPage>
  );
}
