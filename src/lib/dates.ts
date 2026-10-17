import { TZDate, tz } from "@date-fns/tz";
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { dateLocale } from "@/lib/i18n";

/**
 * Date helpers shared by server pages and client components (pure, no server-only).
 *
 * Conventions
 * - Household wall-clock time zone is America/Toronto for now (Ottawa/Gatineau).
 *   TODO: store per-user / per-household tz and thread it through here.
 * - All-day events are stored as UTC midnights with an exclusive end (see lib/recurrence),
 *   so they are always formatted / bucketed in UTC, never in the household tz.
 * - "Day keys" are "yyyy-MM-dd" strings used to bucket things into calendar cells.
 */
export const DEFAULT_TZ = "America/Toronto";
export const WEEK_STARTS_ON = 0 as const; // Sunday, as on most Canadian wall calendars

export const inTz = (zone: string = DEFAULT_TZ) => tz(zone);
const inUtc = tz("UTC");

/** "yyyy-MM-dd" of an instant in the given zone. */
export function dayKey(d: Date, zone: string = DEFAULT_TZ): string {
  return format(d, "yyyy-MM-dd", { in: tz(zone) });
}

/** Today's day key in the household zone. */
export const todayKey = (zone: string = DEFAULT_TZ) => dayKey(new Date(), zone);

/** Parses "yyyy-MM-dd" into a TZDate at local midnight of that day; null if invalid. */
export function parseDayKey(key: string | undefined | null, zone: string = DEFAULT_TZ): TZDate | null {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [y, m, d] = key.split("-").map(Number);
  const date = new TZDate(y, m - 1, d, 0, 0, 0, zone);
  return isValid(date) && dayKey(date, zone) === key ? date : null;
}

/** Wall-clock date + time in `zone` → instant. `time` is "HH:mm". */
export function zonedInstant(dateKey: string, time: string, zone: string = DEFAULT_TZ): Date | null {
  const base = parseDayKey(dateKey, zone);
  if (!base) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const local = new TZDate(base.getFullYear(), base.getMonth(), base.getDate(), Number(m[1]), Number(m[2]), 0, zone);
  return new Date(local.getTime()); // plain Date: serializes as UTC "Z" ISO
}

/** Plain Date (UTC ISO serialization) from any Date, e.g. a TZDate. */
export function plainDate(d: Date): Date {
  return new Date(d.getTime());
}

/** "HH:mm" of an instant in `zone`. */
export const timeKey = (d: Date, zone: string = DEFAULT_TZ) => format(d, "HH:mm", { in: tz(zone) });

/** All day keys an occurrence touches (all-day: UTC, exclusive end; timed: household tz). */
export function occurrenceDayKeys(
  occ: { occurrenceStart: Date; occurrenceEnd: Date; allDay: boolean },
  zone: string = DEFAULT_TZ,
): string[] {
  const z = occ.allDay ? "UTC" : zone;
  const start = new Date(occ.occurrenceStart);
  let end = new Date(occ.occurrenceEnd);
  // Exclusive end for all-day; timed events ending exactly at midnight don't spill over.
  if (end.getTime() > start.getTime()) end = new Date(end.getTime() - 1);
  const first = parseDayKey(dayKey(start, z), z)!;
  const n = Math.max(0, differenceInCalendarDays(end, start, { in: tz(z) }));
  const keys: string[] = [];
  for (let i = 0; i <= Math.min(n, 62); i++) keys.push(dayKey(addDays(first, i), z));
  return keys;
}

/** Visible range of a month grid (full weeks), as [from, to) instants in `zone`. */
export function monthGridRange(anchor: Date, zone: string = DEFAULT_TZ) {
  const opts = { in: tz(zone), weekStartsOn: WEEK_STARTS_ON };
  const from = startOfWeek(startOfMonth(anchor, { in: tz(zone) }), opts);
  const last = endOfWeek(endOfMonth(anchor, { in: tz(zone) }), opts);
  const to = startOfDay(addDays(last, 1), { in: tz(zone) });
  return { from, to };
}

export function weekRange(anchor: Date, zone: string = DEFAULT_TZ) {
  const from = startOfWeek(anchor, { in: tz(zone), weekStartsOn: WEEK_STARTS_ON });
  const to = addDays(from, 7);
  return { from, to };
}

/** Day keys from `from` (inclusive) for `count` days. */
export function dayKeysFrom(from: Date, count: number, zone: string = DEFAULT_TZ): string[] {
  const start = parseDayKey(dayKey(from, zone), zone)!;
  return Array.from({ length: count }, (_, i) => dayKey(addDays(start, i), zone));
}

/* ---------------------------------- formatting ---------------------------------- */

const fmt = (d: Date, pattern: string, zone: string) => format(d, pattern, { in: tz(zone), locale: dateLocale });

/** Format a day key (e.g. calendar headings). Interpreted as a calendar date, no tz shift. */
export function formatDayKey(key: string, pattern: string): string {
  const d = parse(key, "yyyy-MM-dd", new Date());
  return format(d, pattern, { locale: dateLocale });
}

export const formatTime = (d: Date, zone: string = DEFAULT_TZ) =>
  fmt(d, "h:mm a", zone).replace(":00 ", " ").replace("AM", "a.m.").replace("PM", "p.m.");

/** "Sat, Oct 17" style. All-day aware. */
export function formatDate(d: Date, allDay = false, zone: string = DEFAULT_TZ, pattern = "EEE, MMM d") {
  return fmt(d, pattern, allDay ? "UTC" : zone);
}

/** Human time range for an occurrence: "All day", "6 p.m.–7:30 p.m.", "Oct 17 – Oct 19". */
export function formatOccurrenceTime(
  occ: { occurrenceStart: Date; occurrenceEnd: Date; allDay: boolean },
  zone: string = DEFAULT_TZ,
  allDayLabel = "All day",
): string {
  const start = new Date(occ.occurrenceStart);
  const end = new Date(occ.occurrenceEnd);
  if (occ.allDay) {
    const days = occurrenceDayKeys(occ, zone);
    if (days.length <= 1) return allDayLabel;
    return `${formatDayKey(days[0], "MMM d")} – ${formatDayKey(days[days.length - 1], "MMM d")}`;
  }
  if (end.getTime() <= start.getTime()) return formatTime(start, zone);
  if (dayKey(start, zone) !== dayKey(end, zone)) {
    return `${fmt(start, "MMM d", zone)}, ${formatTime(start, zone)} – ${fmt(end, "MMM d", zone)}, ${formatTime(end, zone)}`;
  }
  return `${formatTime(start, zone)} – ${formatTime(end, zone)}`;
}

/* ------------------------------- all-day <-> form ------------------------------- */

/** All-day stored range (UTC midnights, exclusive end) → inclusive day keys for a form. */
export function allDayToForm(startsAt: Date, endsAt: Date | null) {
  const start = dayKey(new Date(startsAt), "UTC");
  const endExclusive = endsAt ? new Date(endsAt) : addDays(new Date(startsAt), 1);
  const lastDay = dayKey(new Date(endExclusive.getTime() - 1), "UTC");
  return { startDate: start, endDate: lastDay < start ? start : lastDay };
}

/** Inclusive last day key → exclusive end day key ("2026-10-19" → "2026-10-20"). */
export function nextDayKey(key: string): string {
  const d = parse(key, "yyyy-MM-dd", new Date());
  return format(addDays(d, 1), "yyyy-MM-dd");
}

/* ----------------------------------- todos ----------------------------------- */

/**
 * Todos with only a due *date* are stored at 23:59 local on that day, so they sort and
 * count as "due today" until the day ends. A due time of 23:59 is shown as date-only.
 */
export const DATE_ONLY_TIME = "23:59";

export function todoDueToForm(dueAt: Date | null, zone: string = DEFAULT_TZ) {
  if (!dueAt) return { date: "", time: "" };
  const d = new Date(dueAt);
  const time = timeKey(d, zone);
  return { date: dayKey(d, zone), time: time === DATE_ONLY_TIME ? "" : time };
}

export function todoDueFromForm(date: string, time: string, zone: string = DEFAULT_TZ): Date | null {
  if (!date) return null;
  return zonedInstant(date, time || DATE_ONLY_TIME, zone);
}

export type DueState = "overdue" | "today" | "tomorrow" | "later";

export function dueState(dueAt: Date, now = new Date(), zone: string = DEFAULT_TZ): DueState {
  const d = new Date(dueAt);
  if (d.getTime() < now.getTime()) return "overdue";
  const diff = differenceInCalendarDays(d, now, { in: tz(zone) });
  if (diff <= 0) return "today";
  if (diff === 1) return "tomorrow";
  return "later";
}

/** "Today", "Tomorrow, 4 p.m.", "Thu, Oct 22". `labels` supplies translated words. */
export function formatDue(
  dueAt: Date,
  labels: { today: string; tomorrow: string },
  now = new Date(),
  zone: string = DEFAULT_TZ,
): string {
  const d = new Date(dueAt);
  const time = timeKey(d, zone);
  const diff = differenceInCalendarDays(d, now, { in: tz(zone) });
  const day =
    diff === 0
      ? labels.today
      : diff === 1
        ? labels.tomorrow
        : fmt(d, Math.abs(diff) > 180 ? "MMM d, yyyy" : "EEE, MMM d", zone);
  return time === DATE_ONLY_TIME ? day : `${day}, ${formatTime(d, zone)}`;
}

export { inUtc };
