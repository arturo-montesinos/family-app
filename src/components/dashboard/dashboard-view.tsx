"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarPlusIcon, ListPlusIcon, PinIcon, StickyNoteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventDialog, type EventDialogTarget } from "@/components/calendar/event-dialog";
import { EventRow } from "@/components/calendar/calendar-view";
import { PostCard } from "@/components/board/post-card";
import { TodoDialog } from "@/components/todos/todo-dialog";
import { TodoItem } from "@/components/todos/todo-item";
import type { EventOccurrence } from "@/lib/db/queries/events";
import type { PostWithAuthor } from "@/lib/db/queries/posts";
import type { Todo } from "@/lib/db/schema";
import { formatDayKey, occurrenceDayKeys } from "@/lib/dates";
import { t } from "@/lib/i18n";
import { memberMap, type FamilyMember } from "@/lib/members";
import type { Actor } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type Props = {
  todayKey: string;
  occurrences: EventOccurrence[];
  dueTodos: Todo[];
  pinned: PostWithAuthor[];
  members: FamilyMember[];
  me: FamilyMember;
  actor: Actor;
  tz: string;
};

const subscribeNoop = () => () => {};

/** Greeting by the viewer's local hour (client only, to avoid a server/client mismatch). */
function useGreeting(name: string) {
  const hour = useSyncExternalStore(subscribeNoop, () => new Date().getHours(), () => 9);
  const key = hour < 12 ? "dash.greeting.morning" : hour < 18 ? "dash.greeting.afternoon" : "dash.greeting.evening";
  return t(key, { name });
}

export function DashboardView({ todayKey, occurrences, dueTodos, pinned, members, me, actor, tz }: Props) {
  const byId = useMemo(() => memberMap(members), [members]);
  const [eventTarget, setEventTarget] = useState<EventDialogTarget | null>(null);
  const [todoTarget, setTodoTarget] = useState<Todo | "new" | null>(null);
  const greeting = useGreeting(me.name);

  // Bucket occurrences by day; a multi-day event appears once, on its first visible day.
  const { todayItems, upcoming } = useMemo(() => {
    const todayItems: EventOccurrence[] = [];
    const later = new Map<string, EventOccurrence[]>();
    for (const occ of occurrences) {
      const keys = occurrenceDayKeys(occ, tz);
      if (keys.includes(todayKey)) {
        todayItems.push(occ);
        continue;
      }
      const first = keys.find((k) => k > todayKey);
      if (!first) continue;
      later.set(first, [...(later.get(first) ?? []), occ]);
    }
    return { todayItems, upcoming: [...later.entries()].sort(([a], [b]) => a.localeCompare(b)) };
  }, [occurrences, todayKey, tz]);

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm font-medium text-muted-foreground">{formatDayKey(todayKey, "EEEE, MMMM d")}</p>
        <h1 className="mt-1 text-[2rem] leading-tight font-semibold sm:text-4xl" suppressHydrationWarning>
          {greeting}
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <QuickAdd icon={CalendarPlusIcon} label={t("dash.addEvent")} onClick={() => setEventTarget({ mode: "create", date: todayKey, time: nextHour() })} />
          <QuickAdd icon={ListPlusIcon} label={t("dash.addTodo")} onClick={() => setTodoTarget("new")} />
          <Button asChild variant="outline" className="h-10 rounded-full bg-card">
            <Link href="/board">
              <StickyNoteIcon /> {t("dash.addPost")}
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          {/* Today: the one bold surface on the page. */}
          <section aria-labelledby="dash-today" className="rounded-3xl bg-today/25 p-4 ring-1 ring-today/50 sm:p-5 dark:bg-today/10">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 id="dash-today" className="text-xl font-semibold">
                {t("dash.today")}
              </h2>
              <Link href="/calendar" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                {t("dash.seeCalendar")}
              </Link>
            </div>
            {todayItems.length === 0 ? (
              <p className="py-3 text-muted-foreground">{t("dash.nothingToday")}</p>
            ) : (
              <ul className="grid gap-1 rounded-2xl bg-card p-1.5">
                {todayItems.map((o) => (
                  <li key={o.occurrenceKey}>
                    <EventRow occ={o} byId={byId} tz={tz} onOpen={(occurrence) => setEventTarget({ mode: "edit", occurrence })} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="dash-week">
            <h2 id="dash-week" className="mb-3 text-xl font-semibold">
              {t("dash.upcoming")}
            </h2>
            {upcoming.length === 0 ? (
              <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                {t("dash.nothingUpcoming")}
              </p>
            ) : (
              <ol className="grid gap-3">
                {upcoming.map(([k, items]) => (
                  <li key={k} className="grid grid-cols-[3.25rem_1fr] gap-3">
                    <div className="pt-1.5 text-center leading-none">
                      <span className="block text-xs font-medium text-muted-foreground">{formatDayKey(k, "EEE")}</span>
                      <span className="mt-1 block font-display text-2xl font-semibold tabular-nums">{formatDayKey(k, "d")}</span>
                    </div>
                    <ul className="grid gap-1 rounded-2xl border bg-card p-1.5">
                      {items.map((o) => (
                        <li key={o.occurrenceKey}>
                          <EventRow occ={o} byId={byId} tz={tz} onOpen={(occurrence) => setEventTarget({ mode: "edit", occurrence })} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="grid content-start gap-6">
          <section aria-labelledby="dash-due">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 id="dash-due" className="text-xl font-semibold">
                {t("dash.due")}
              </h2>
              <Link href="/todos" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                {t("dash.seeTodos")}
              </Link>
            </div>
            <div className="rounded-2xl border bg-card p-1.5">
              {dueTodos.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">{t("dash.dueEmpty")}</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {dueTodos.slice(0, 8).map((td) => (
                    <li key={td.id}>
                      <TodoItem todo={td} byId={byId} actor={actor} onEdit={setTodoTarget} tz={tz} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section aria-labelledby="dash-pinned">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 id="dash-pinned" className="flex items-center gap-2 text-xl font-semibold">
                <PinIcon className="size-4 text-muted-foreground" aria-hidden />
                {t("dash.pinned")}
              </h2>
              <Link href="/board" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                {t("dash.seeBoard")}
              </Link>
            </div>
            {pinned.length === 0 ? (
              <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                {t("dash.pinnedEmpty")}
              </p>
            ) : (
              <ul className="grid gap-5 pt-2">
                {pinned.map((p) => (
                  <li key={p.id}>
                    <PostCard post={p} author={p.authorId ? byId.get(p.authorId) : undefined} actor={actor} compact />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <EventDialog target={eventTarget} onClose={() => setEventTarget(null)} members={members} me={me} actor={actor} tz={tz} />
      <TodoDialog todo={todoTarget} onClose={() => setTodoTarget(null)} members={members} actor={actor} tz={tz} />
    </div>
  );
}

function QuickAdd({ icon: Icon, label, onClick }: { icon: typeof ListPlusIcon; label: string; onClick: () => void }) {
  return (
    <Button onClick={onClick} className={cn("h-10 rounded-full")}>
      <Icon /> {label}
    </Button>
  );
}

function nextHour(): string {
  const h = Math.min(23, new Date().getHours() + 1);
  return `${String(h).padStart(2, "0")}:00`;
}
