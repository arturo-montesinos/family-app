import { CalendarDaysIcon, ListChecksIcon, PinIcon, SettingsIcon, SunIcon, type LucideIcon } from "lucide-react";
import type { MessageKey } from "@/lib/i18n";

export type NavItem = { href: string; label: MessageKey; icon: LucideIcon; match: string };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "nav.dashboard", icon: SunIcon, match: "/dashboard" },
  { href: "/calendar", label: "nav.calendar", icon: CalendarDaysIcon, match: "/calendar" },
  { href: "/todos", label: "nav.todos", icon: ListChecksIcon, match: "/todos" },
  { href: "/board", label: "nav.board", icon: PinIcon, match: "/board" },
  { href: "/settings/household", label: "nav.settings", icon: SettingsIcon, match: "/settings" },
];
