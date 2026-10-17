import { RRule, type Options as RRuleOptions } from "rrule";

/**
 * Pure recurrence helpers (no DB, no server-only) so they can be unit-tested and reused by
 * the calendar UI.
 *
 * Conventions
 * - `rrule` holds an RFC 5545 RRULE body, e.g. "FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10". An
 *   optional "RRULE:" prefix is accepted. DTSTART is always the event's `startsAt`; any
 *   DTSTART line inside the string is ignored.
 * - Timed events recur in wall-clock time of `timeZone` (default UTC), so "every Monday
 *   18:00" stays at 18:00 local across DST changes and BYDAY is evaluated on the local day.
 * - All-day events are stored as UTC midnight of their first day (`startsAt`) with an
 *   exclusive `endsAt` (UTC midnight of the day after the last day). A missing `endsAt`
 *   means a single day. All-day expansion is always done in UTC.
 * - A timed event without `endsAt` is a zero-length point in time.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Hard cap on generated occurrences per event per query, to protect against runaway rules. */
export const MAX_OCCURRENCES_PER_EVENT = 1000;

export type RecurringEventLike = {
  id: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  rrule: string | null;
};

export type Occurrence<E extends RecurringEventLike = RecurringEventLike> = E & {
  /** Id of the parent event row (same as `id`, explicit for clarity on the client). */
  eventId: string;
  /** Stable unique key per occurrence: `${eventId}:${occurrenceStart ISO}`. */
  occurrenceKey: string;
  occurrenceStart: Date;
  occurrenceEnd: Date;
  isRecurring: boolean;
};

/* -------------------------------------------------------------------------- */
/*  RRULE parsing                                                             */
/* -------------------------------------------------------------------------- */

function normalizeRuleString(rule: string): string {
  const lines = rule
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^DTSTART/i.test(l));
  const rruleLine = lines.find((l) => /^RRULE:/i.test(l)) ?? lines[0] ?? "";
  return rruleLine.replace(/^RRULE:/i, "");
}

/** Parses an RRULE string into rrule options (without dtstart). Throws on invalid input. */
export function parseRRule(rule: string): Partial<RRuleOptions> {
  const body = normalizeRuleString(rule);
  if (!body) throw new Error("Empty recurrence rule");
  const opts = RRule.parseString(body);
  if (opts.freq === undefined || opts.freq === null) {
    throw new Error("Recurrence rule must include FREQ");
  }
  delete opts.dtstart;
  return opts;
}

/** True when `rule` is a parseable RRULE with a FREQ. */
export function isValidRRule(rule: string): boolean {
  try {
    parseRRule(rule);
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*  Time-zone helpers (Intl only, no extra dependency)                        */
/*  "Floating" dates encode a wall-clock time in a time zone as if it were UTC. */
/* -------------------------------------------------------------------------- */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/** Instant → floating date carrying the wall-clock time of `timeZone` in its UTC fields. */
export function toFloating(instant: Date, timeZone: string): Date {
  if (timeZone === "UTC") return new Date(instant.getTime());
  const parts = getFormatter(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(
    Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
      instant.getUTCMilliseconds(),
    ),
  );
}

/** Floating wall-clock date in `timeZone` → real instant. Nonexistent (DST gap) times shift forward. */
export function fromFloating(floating: Date, timeZone: string): Date {
  if (timeZone === "UTC") return new Date(floating.getTime());
  const target = floating.getTime();
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const offset = toFloating(new Date(guess), timeZone).getTime() - guess;
    const next = target - offset;
    if (next === guess) break;
    guess = next;
  }
  return new Date(guess);
}

/* -------------------------------------------------------------------------- */
/*  Expansion                                                                 */
/* -------------------------------------------------------------------------- */

/** Duration of one occurrence in ms (all-day default: 1 day; timed default: 0). */
export function eventDurationMs(event: Pick<RecurringEventLike, "startsAt" | "endsAt" | "allDay">): number {
  const raw = event.endsAt ? event.endsAt.getTime() - event.startsAt.getTime() : 0;
  if (event.allDay) return raw > 0 ? raw : DAY_MS;
  return Math.max(0, raw);
}

/** Half-open overlap with [from, to); zero-length occurrences count when start ∈ [from, to). */
export function overlaps(start: Date, end: Date, from: Date, to: Date): boolean {
  const s = start.getTime();
  const e = end.getTime();
  if (s >= to.getTime()) return false;
  if (e === s) return s >= from.getTime();
  return e > from.getTime();
}

/**
 * Expands one event into the occurrences that overlap [from, to).
 * Non-recurring events yield 0 or 1 occurrence. Invalid rules fall back to the single
 * base occurrence rather than throwing (validators prevent them from being stored).
 */
export function expandEvent<E extends RecurringEventLike>(
  event: E,
  from: Date,
  to: Date,
  opts: { timeZone?: string; maxOccurrences?: number } = {},
): Occurrence<E>[] {
  const duration = eventDurationMs(event);
  const make = (start: Date, isRecurring: boolean): Occurrence<E> => ({
    ...event,
    eventId: event.id,
    occurrenceKey: `${event.id}:${start.toISOString()}`,
    occurrenceStart: start,
    occurrenceEnd: new Date(start.getTime() + duration),
    isRecurring,
  });

  const single = (): Occurrence<E>[] => {
    const occ = make(event.startsAt, false);
    return overlaps(occ.occurrenceStart, occ.occurrenceEnd, from, to) ? [occ] : [];
  };

  if (!event.rrule) return single();

  let options: Partial<RRuleOptions>;
  try {
    options = parseRRule(event.rrule);
  } catch {
    return single();
  }

  const timeZone = event.allDay ? "UTC" : (opts.timeZone ?? "UTC");
  const max = opts.maxOccurrences ?? MAX_OCCURRENCES_PER_EVENT;

  const dtstart = toFloating(event.startsAt, timeZone);
  // UNTIL in an RRULE string ending in "Z" is a real instant; convert it to floating too.
  if (options.until) options.until = toFloating(options.until, timeZone);

  const rule = new RRule({ ...options, dtstart });

  // Search window in floating time, widened by the duration (to catch occurrences that
  // started before `from` but are still running) and a day of slack for tz offsets.
  const windowStart = new Date(toFloating(from, timeZone).getTime() - duration - DAY_MS);
  const windowEnd = new Date(toFloating(to, timeZone).getTime() + DAY_MS);

  const result: Occurrence<E>[] = [];
  rule.between(windowStart, windowEnd, true, (date) => {
    const start = fromFloating(date, timeZone);
    const occ = make(start, true);
    if (overlaps(occ.occurrenceStart, occ.occurrenceEnd, from, to)) result.push(occ);
    return result.length < max;
  });
  return result;
}

/** Expands many events and returns all occurrences sorted by start (then all-day first). */
export function expandEvents<E extends RecurringEventLike>(
  events: E[],
  from: Date,
  to: Date,
  opts: { timeZone?: string; maxOccurrences?: number } = {},
): Occurrence<E>[] {
  return events
    .flatMap((e) => expandEvent(e, from, to, opts))
    .sort(
      (a, b) =>
        a.occurrenceStart.getTime() - b.occurrenceStart.getTime() ||
        Number(b.allDay) - Number(a.allDay),
    );
}

/* -------------------------------------------------------------------------- */
/*  All-day normalization                                                     */
/* -------------------------------------------------------------------------- */

const utcMidnight = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Normalizes an all-day range to UTC midnights: start → floor to its UTC day, end →
 * ceil to the next UTC midnight (exclusive). A missing or non-positive end → 1 day.
 */
export function normalizeAllDayRange(startsAt: Date, endsAt: Date | null | undefined): { startsAt: Date; endsAt: Date } {
  const start = utcMidnight(startsAt);
  let end = endsAt ? utcMidnight(endsAt) : null;
  if (end && endsAt && end.getTime() !== endsAt.getTime()) end = new Date(end.getTime() + DAY_MS);
  if (!end || end.getTime() <= start.getTime()) end = new Date(start.getTime() + DAY_MS);
  return { startsAt: start, endsAt: end };
}
