"use client";

import { LaptopIcon, LogOutIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MemberAvatar } from "@/components/common/member-avatar";
import type { FamilyMember } from "@/lib/members";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function UserMenu({
  me,
  email,
  signOutAction,
  showName,
}: {
  me: FamilyMember;
  email: string | null;
  signOutAction: () => Promise<void>;
  showName?: boolean;
}) {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("user.menu")}
        className={cn(
          "flex min-w-0 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          showName ? "w-full px-3 py-2 hover:bg-sidebar-accent" : "rounded-full",
        )}
      >
        <MemberAvatar member={me} size={showName ? "md" : "sm"} />
        {showName ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{me.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{t(`role.${me.role}`)}</span>
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={showName ? "top" : "bottom"} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-medium">{me.name}</span>
          {email ? <span className="block truncate text-xs text-muted-foreground">{email}</span> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("theme.label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="system">
            <LaptopIcon className="size-4" /> {t("theme.system")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <SunIcon className="size-4" /> {t("theme.light")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon className="size-4" /> {t("theme.dark")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent focus-visible:bg-accent"
          >
            <LogOutIcon className="size-4 text-muted-foreground" /> {t("user.signOut")}
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
