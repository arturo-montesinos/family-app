import { cn } from "@/lib/utils";

/** Page title row: title on the left, actions on the right (wrap under on narrow screens). */
export function PageHeader({
  title,
  children,
  className,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-3", className)}>
      <h1 className="text-[1.75rem] leading-tight font-semibold sm:text-3xl">{title}</h1>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
