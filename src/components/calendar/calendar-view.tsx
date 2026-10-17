"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, RepeatIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { AvatarStack } from "@/components/common/member-avatar";
import type { EventOccurrence } from "@/lib/db/queries/events";
import { dayKeysFrom, formatDayKey, formatOccurrenceTime, occurrenceDayKeys, parseDayKey } from "@/lib/dates";
import { t } from "@/lib/i18n";
import { eventColor, memberMap, type FamilyMember } from "@/lib/members";
import type { Actor } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { EventDialog, type EventDialogTarget } from "./event-dialog";

type Props = {
  view: "month" | "week";
  anchorKey: string;
  todayKey: string;
  rangeStartKey: string;
  dayCount: number;
  prevKey: string;
  nextKey: string;
  occurrences: EventOccurrence[];
  members: FamilyMember[];
  me: FamilyMember;
  actor: Actor;
  tz: string;
};

const href = (view: string, date: string) => `/calendar?view=${view}&date=${date}`;

export function CalendarView(props: Props) {
  const { view, anchorKey, todayKey, rangeStartKey, dayCount, prevKey, nextKey, occurrences, members, me, actor, tz } =
    props;
  const [target, setTarget] = useState<EventDialogTarget | null>(null);
  const [selected, setSelected] = useState<string>(
    anchorKey.slice(0, 7) === todayKey.slice(0, 7) || view === "week" ? todayKey : anchorKey,
  );

  const byId = useMemo(() => memberMap(members), [members]);
  const days = useMemo(() => dayKeysFrom(parseDayKey(rangeStartKey, tz)!, dayCount, tz), [rangeStartKey, dayCount, tz]);
  const byDay = useMemo(() => {
    const map = new Map<string, EventOccurrence[]>();
    for (const occ of occurrences) {
      for (const k of occurrenceDayKeys(occ, tz)) {
        const arr = map.get(k) ?? [];
        arr.push(occ);
        map.set(k, arr);
      }
    }
    return map;
  }, [occurrences, tz]);

  const title =
    view === "month"
      ? formatDayKey(anchorKey, "MMMM yyyy")
      : `${formatDayKey(days[0], "MMM d")} – ${formatDayKey(days[6], days[0].slice(5, 7) === days[6].slice(5, 7) ? "d" : "MMM d")}`;

  const openNew = (date: string) => setTarget({ mode: "create", date });
  const openEdit = (occurrence: EventOccurrence) => setTarget({ mode: "edit", occurrence });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-3">
        <h1 className="mr-auto text-[1.75rem] leading-tight font-semibold sm:text-3xl">{title}</h1>
        <div className="flex items-center gap-1">
          <Link href={href(view, prevKey)} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={t("cal.prev")}>
            <ChevronLeftIcon />
          </Link>
          <Link href={href(view, todayKey)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t("cal.today")}
          </Link>
          <Link href={href(view, nextKey)} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={t("cal.next")}>
            <ChevronRightIcon />
          </Link>
        </div>
        <div role="tablist" aria-label="View" className="inline-flex rounded-lg bg-muted p-[3px]">
          {(["month", "week"] as const).map((v) => (
            <Link
              key={v}
              role="tab"
              aria-selected={view === v}
              href={href(v, anchorKey)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium text-muted-foreground",
                view === v && "bg-card text-foreground shadow-sm",
              )}
            >
              {t(v === "month" ? "cal.month" : "cal.week")}
            </Link>
          ))}
        </div>
        <Button onClick={() => openNew(selected)} className="max-sm:fixed max-sm:right-4 max-sm:bottom-[calc(5.5rem+env(safe-area-inset-bottom))] max-sm:z-30 max-sm:size-14 max-sm:rounded-full max-sm:shadow-lg">
          <PlusIcon className="max-sm:size-6" />
          <span className="max-sm:sr-only">{t("cal.new")}</span>
        </Button>
      </div>

      {view === "month" ? (
        <MonthGrid
          days={days}
          anchorMonth={anchorKey.slice(0, 7)}
          todayKey={todayKey}
          selected={selected}
          onSelect={setSelected}
          byDay={byDay}
          byId={byId}
          onOpen={openEdit}
          onNew={openNew}
        />
      ) : (
        <WeekColumns days={days} todayKey={todayKey} byDay={byDay} byId={byId} onOpen={openEdit} onNew={openNew} tz={tz} />
      )}

      {view === "month" ? (
        <section className="mt-5 md:hidden" aria-live="polite">
          <DayAgenda
            dayKey={selected}
            isToday={selected === todayKey}
            items={byDay.get(selected) ?? []}
            byId={byId}
            onOpen={openEdit}
            onNew={openNew}
            tz={tz}
          />
        </section>
      ) : null}

      <EventDialog target={target} onClose={() => setTarget(null)} members={members} me={me} actor={actor} tz={tz} />
    </div>
  );
}

/* ------------------------------------ month ------------------------------------ */

function MonthGrid({
  days,
  anchorMonth,
  todayKey,
  selected,
  onSelect,
  byDay,
  byId,
  onOpen,
  onNew,
}: {
  days: string[];
  anchorMonth: string;
  todayKey: string;
  selected: string;
  onSelect: (k: string) => void;
  byDay: Map<string, EventOccurrence[]>;
  byId: Map<string, FamilyMember>;
  onOpen: (o: EventOccurrence) => void;
  onNew: (k: string) => void;
}) {
  const weekdays = days.slice(0, 7);
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
        {weekdays.map((k) => (
          <div key={k} className="py-2">
            <span className="md:hidden">{formatDayKey(k, "EEEEE")}</span>
            <span className="hidden md:inline">{formatDayKey(k, "EEE")}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((k, i) => {
          const items = byDay.get(k) ?? [];
          const inMonth = k.slice(0, 7) === anchorMonth;
          const isToday = k === todayKey;
          const isSelected = k === selected;
          return (
            <div
              key={k}
              className={cn(
                "group relative min-h-16 border-t border-l p-1 md:min-h-28 md:p-1.5",
                i % 7 === 0 && "border-l-0",
                i < 7 && "border-t-0",
                !inMonth && "bg-muted/30",
              )}
            >
              {/* Mobile: whole cell selects the day. Desktop: number button + chips. */}
              <button
                type="button"
                onClick={() => onSelect(k)}
                className="absolute inset-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset md:hidden"
                aria-label={formatDayKey(k, "EEEE, MMMM d")}
                aria-pressed={isSelected}
              />
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-sm tabular-nums",
                    !inMonth && "text-muted-foreground/70",
                    isToday && "bg-today font-semibold text-today-foreground",
                    isSelected && !isToday && "max-md:bg-foreground max-md:text-background",
                  )}
                >
                  {Number(k.slice(8))}
                </span>
                <button
                  type="button"
                  onClick={() => onNew(k)}
                  className="hidden size-6 place-items-center rounded-md text-muted-foreground opacity-0 outline-none group-hover:opacity-100 hover:bg-accent focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 md:grid"
                  aria-label={t("cal.addOn", { date: formatDayKey(k, "MMMM d") })}
                >
                  <PlusIcon className="size-4" />
                </button>
              </div>
              {/* mobile dots */}
              <div className="mt-1 flex flex-wrap justify-center gap-0.5 md:hidden" aria-hidden>
                {items.slice(0, 4).map((o) => (
                  <span key={o.occurrenceKey} className="size-1.5 rounded-full" style={{ backgroundColor: eventColor(o, byId) }} />
                ))}
              </div>
              {/* desktop chips */}
              <ul className="mt-1 hidden gap-0.5 md:grid">
                {items.slice(0, 3).map((o) => (
                  <li key={o.occurrenceKey}>
                    <EventChip occ={o} color={eventColor(o, byId)} onOpen={onOpen} />
                  </li>
                ))}
                {items.length > 3 ? (
                  <li>
                    <Link
                      href={`/calendar?view=week&date=${k}`}
                      className="block px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      {t("cal.more", { count: items.length - 3 })}
                    </Link>
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventChip({
  occ,
  color,
  onOpen,
}: {
  occ: EventOccurrence;
  color: string;
  onOpen: (o: EventOccurrence) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(occ)}
      className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      style={occ.allDay ? { backgroundColor: `color-mix(in oklab, ${color} 22%, transparent)` } : undefined}
    >
      {!occ.allDay ? <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden /> : null}
      <span className="truncate font-medium">{occ.title}</span>
    </button>
  );
}

/* ------------------------------------- week ------------------------------------- */

function WeekColumns({
  days,
  todayKey,
  byDay,
  byId,
  onOpen,
  onNew,
  tz,
}: {
  days: string[];
  todayKey: string;
  byDay: Map<string, EventOccurrence[]>;
  byId: Map<string, FamilyMember>;
  onOpen: (o: EventOccurrence) => void;
  onNew: (k: string) => void;
  tz: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-7 md:gap-2">
      {days.map((k) => (
        <DayAgenda
          key={k}
          dayKey={k}
          isToday={k === todayKey}
          items={byDay.get(k) ?? []}
          byId={byId}
          onOpen={onOpen}
          onNew={onNew}
          tz={tz}
          column
        />
      ))}
    </div>
  );
}

/** One day's events as a list: the mobile month-view detail and each week column. */
function DayAgenda({
  dayKey: k,
  isToday,
  items,
  byId,
  onOpen,
  onNew,
  tz,
  column,
}: {
  dayKey: string;
  isToday: boolean;
  items: EventOccurrence[];
  byId: Map<string, FamilyMember>;
  onOpen: (o: EventOccurrence) => void;
  onNew: (k: string) => void;
  tz: string;
  column?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-3",
        column && "md:min-h-64 md:p-2",
        isToday && "border-today/70 ring-1 ring-today/40",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className={cn("flex items-baseline gap-2 text-base font-semibold", column && "md:flex-col md:gap-0")}>
          <span className={cn(column && "md:text-xs md:font-medium md:text-muted-foreground")}>
            {formatDayKey(k, column ? "EEE" : "EEEE")}
          </span>
          <span
            className={cn(
              "tabular-nums",
              column && "md:text-2xl",
              isToday && "rounded-md bg-today px-1.5 text-today-foreground",
            )}
          >
            {formatDayKey(k, column ? "d" : "MMMM d")}
          </span>
        </h2>
        <button
          type="button"
          onClick={() => onNew(k)}
          className="grid size-8 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label={t("cal.addOn", { date: formatDayKey(k, "MMMM d") })}
        >
          <PlusIcon className="size-4" />
        </button>
      </div>
      {items.length === 0 ? (
        <p className={cn("px-1 pb-1 text-sm text-muted-foreground", column && "md:sr-only")}>{t("cal.noEvents")}</p>
      ) : (
        <ul className="grid gap-1.5">
          {items.map((o) => (
            <li key={o.occurrenceKey}>
              <EventRow occ={o} byId={byId} onOpen={onOpen} tz={tz} compact={column} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EventRow({
  occ,
  byId,
  onOpen,
  tz,
  compact,
}: {
  occ: EventOccurrence;
  byId: Map<string, FamilyMember>;
  onOpen?: (o: EventOccurrence) => void;
  tz: string;
  compact?: boolean;
}) {
  const color = eventColor(occ, byId);
  const attendees = occ.attendeeIds.map((id) => byId.get(id)).filter((m): m is FamilyMember => !!m);
  const body = (
    <>
      <span className="w-1 self-stretch rounded-full" style={{ backgroundColor: color }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {formatOccurrenceTime(occ, tz, t("cal.allDay"))}
          {occ.isRecurring ? <RepeatIcon className="size-3" aria-label={t("cal.repeats")} /> : null}
        </span>
        <span className={cn("block font-medium", compact ? "text-sm md:line-clamp-2" : "truncate")}>{occ.title}</span>
        {occ.location && !compact ? <span className="block truncate text-xs text-muted-foreground">{occ.location}</span> : null}
      </span>
      {attendees.length ? (
        <AvatarStack members={attendees} max={3} size="xs" className={cn(compact && "md:hidden")} />
      ) : null}
    </>
  );
  const cls =
    "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50";
  return onOpen ? (
    <button type="button" className={cls} onClick={() => onOpen(occ)}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
