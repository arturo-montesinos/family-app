"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setActiveHousehold } from "@/lib/actions/households";
import { toastResult } from "@/lib/action-client";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type SwitcherHousehold = { id: string; name: string; role: string };

export function HouseholdSwitcher({
  households,
  activeId,
  memberColors,
  compact,
}: {
  households: SwitcherHousehold[];
  activeId: string;
  /** Colours of the active household's members, shown as a little strip. */
  memberColors: string[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = households.find((h) => h.id === activeId);

  function choose(id: string) {
    if (id === activeId) return;
    start(async () => {
      const res = await setActiveHousehold(id);
      if (toastResult(res)) router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex min-w-0 items-center gap-2 rounded-xl text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          compact ? "px-1 py-1" : "w-full px-3 py-2.5 hover:bg-sidebar-accent",
          pending && "opacity-60",
        )}
        aria-label={t("household.switch")}
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate font-display font-semibold tracking-tight",
              compact ? "text-lg" : "text-xl leading-tight",
            )}
          >
            {active?.name ?? t("app.name")}
          </span>
          {!compact ? <FamilyStrip colors={memberColors} className="mt-2" /> : null}
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground">{t("household.yours")}</DropdownMenuLabel>
        {households.map((h) => (
          <DropdownMenuItem key={h.id} onSelect={() => choose(h.id)} className="gap-2">
            <span className="flex-1 truncate">{h.name}</span>
            {h.id === activeId ? <CheckIcon className="size-4 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding">
            <PlusIcon className="size-4" />
            {t("household.new")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A row of member colour segments: the household at a glance. */
export function FamilyStrip({ colors, className }: { colors: string[]; className?: string }) {
  if (colors.length === 0) return null;
  return (
    <span aria-hidden className={cn("flex h-1.5 gap-1", className)}>
      {colors.map((c, i) => (
        <span key={i} className="h-full flex-1 rounded-full" style={{ backgroundColor: c, maxWidth: "2.25rem" }} />
      ))}
    </span>
  );
}
