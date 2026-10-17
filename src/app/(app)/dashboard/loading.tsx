import { Skeleton, SkeletonPage } from "@/components/common/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-10 w-72 max-w-full" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="grid content-start gap-6">
          <Skeleton className="h-44 rounded-3xl" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <div className="grid content-start gap-6">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </div>
    </SkeletonPage>
  );
}
