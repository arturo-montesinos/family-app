"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LINKS: { href: string; label: MessageKey; ownerOnly: boolean }[] = [
  { href: "/settings/household", label: "settings.navHousehold", ownerOnly: false },
  { href: "/settings/api-keys", label: "settings.navApiKeys", ownerOnly: true },
  { href: "/settings/activity", label: "settings.navActivity", ownerOnly: true },
];

/** Settings sub-navigation (pill tabs). Owner-only sections are hidden for everyone else. */
export function SettingsNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const links = LINKS.filter((l) => isOwner || !l.ownerOnly);
  if (links.length < 2) return null;
  return (
    <nav aria-label={t("settings.nav")} className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="inline-flex gap-1 rounded-xl bg-muted p-1">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  active && "bg-card text-foreground shadow-sm",
                )}
              >
                {t(l.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
