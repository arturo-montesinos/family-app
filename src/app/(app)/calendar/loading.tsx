import { Skeleton, SkeletonPage } from "@/components/common/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Skeleton className="mr-auto h-9 w-48" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border">
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-none md:h-28" />
        ))}
      </div>
    </SkeletonPage>
  );
}
