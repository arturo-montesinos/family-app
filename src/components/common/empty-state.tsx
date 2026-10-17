import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center text-muted-foreground",
        className,
      )}
    >
      {Icon ? <Icon className="size-7 text-muted-foreground/70" aria-hidden /> : null}
      <p className="max-w-xs text-sm text-balance">{title}</p>
      {children}
    </div>
  );
}
