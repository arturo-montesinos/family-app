import { Skeleton, SkeletonPage } from "@/components/common/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <div className="max-w-3xl">
        <Skeleton className="mb-8 h-9 w-48" />
        <Skeleton className="mb-10 h-48 rounded-2xl" />
        <Skeleton className="mb-3 h-6 w-32" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    </SkeletonPage>
  );
}
