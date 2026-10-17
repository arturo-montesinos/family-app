import { Skeleton, SkeletonPage } from "@/components/common/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <Skeleton className="mb-5 h-9 w-28" />
      <Skeleton className="h-32 rounded-2xl" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    </SkeletonPage>
  );
}
