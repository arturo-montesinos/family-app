import { Skeleton, SkeletonPage } from "@/components/common/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <div className="max-w-2xl">
        <Skeleton className="mb-8 h-9 w-64" />
        <Skeleton className="mb-3 h-6 w-32" />
        <Skeleton className="mb-10 h-10" />
        <Skeleton className="mb-3 h-6 w-32" />
        <div className="grid gap-2 rounded-2xl border p-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <Skeleton className="h-5 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
