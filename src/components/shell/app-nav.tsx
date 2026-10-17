"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { NAV_ITEMS } from "./nav-items";

const isActive = (pathname: string, match: string) => pathname === match || pathname.startsWith(match + "/");

/** Desktop sidebar links. */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label={t("nav.main")} className="grid gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
        const active = isActive(pathname, match);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-medium text-sidebar-foreground/80 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active && "bg-card text-sidebar-foreground shadow-[0_1px_0_var(--border)]",
            )}
          >
            <Icon className={cn("size-5", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
            {t(label)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile bottom tab bar. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-safe backdrop-blur supports-[backdrop-filter]:bg-card/85 md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = isActive(pathname, match);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 pt-2 pb-1.5 text-[0.7rem] font-medium text-muted-foreground outline-none focus-visible:bg-accent",
                  active && "text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors",
                    active && "bg-primary/12 text-primary",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                {t(label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
