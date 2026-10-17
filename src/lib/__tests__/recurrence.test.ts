import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  expandEvent,
  expandEvents,
  fromFloating,
  isValidRRule,
  normalizeAllDayRange,
  toFloating,
  type RecurringEventLike,
} from "@/lib/recurrence";

const d = (iso: string) => new Date(iso);
const ev = (o: Partial<RecurringEventLike> & Pick<RecurringEventLike, "startsAt">): RecurringEventLike => ({
  id: "e1",
  endsAt: null,
  allDay: false,
  rrule: null,
  ...o,
});
const starts = (occ: { occurrenceStart: Date }[]) => occ.map((o) => o.occurrenceStart.toISOString());

describe("isValidRRule", () => {
  it("accepts valid rules with or without RRULE: prefix", () => {
    expect(isValidRRule("FREQ=WEEKLY;BYDAY=MO")).toBe(true);
    expect(isValidRRule("RRULE:FREQ=DAILY;COUNT=3")).toBe(true);
    expect(isValidRRule("DTSTART:20260101T000000Z\nRRULE:FREQ=MONTHLY")).toBe(true);
  });
  it("rejects garbage and rules without FREQ", () => {
    expect(isValidRRule("")).toBe(false);
    expect(isValidRRule("BYDAY=MO")).toBe(false);
    expect(isValidRRule("FREQ=SOMETIMES")).toBe(false);
  });
});

describe("expandEvent — one-off events", () => {
  const e = ev({ startsAt: d("2026-10-20T10:00:00Z"), endsAt: d("2026-10-20T11:00:00Z") });

  it("returns the event when it overlaps the range", () => {
    const r = expandEvent(e, d("2026-10-20T00:00:00Z"), d("2026-10-21T00:00:00Z"));
    expect(r).toHaveLength(1);
    expect(r[0].eventId).toBe("e1");
    expect(r[0].isRecurring).toBe(false);
    expect(r[0].occurrenceEnd.toISOString()).toBe("2026-10-20T11:00:00.000Z");
  });

  it("includes events that started before the range but are still running", () => {
    expect(expandEvent(e, d("2026-10-20T10:30:00Z"), d("2026-10-20T12:00:00Z"))).toHaveLength(1);
  });

  it("uses a half-open range: [from, to)", () => {
    expect(expandEvent(e, d("2026-10-20T11:00:00Z"), d("2026-10-21T00:00:00Z"))).toHaveLength(0);
    expect(expandEvent(e, d("2026-10-19T00:00:00Z"), d("2026-10-20T10:00:00Z"))).toHaveLength(0);
  });

  it("treats a timed event without endsAt as a point in time", () => {
    const p = ev({ startsAt: d("2026-10-20T10:00:00Z") });
    expect(expandEvent(p, d("2026-10-20T10:00:00Z"), d("2026-10-20T10:00:01Z"))).toHaveLength(1);
    expect(expandEvent(p, d("2026-10-20T10:00:01Z"), d("2026-10-21T00:00:00Z"))).toHaveLength(0);
  });
});

describe("expandEvent — recurring", () => {
  const weekly = ev({
    startsAt: d("2026-10-05T18:00:00Z"), // Monday
    endsAt: d("2026-10-05T19:00:00Z"),
    rrule: "FREQ=WEEKLY;BYDAY=MO",
  });

  it("expands weekly occurrences within the range only", () => {
    const r = expandEvent(weekly, d("2026-10-10T00:00:00Z"), d("2026-11-01T00:00:00Z"));
    expect(starts(r)).toEqual([
      "2026-10-12T18:00:00.000Z",
      "2026-10-19T18:00:00.000Z",
      "2026-10-26T18:00:00.000Z",
    ]);
    expect(r.every((o) => o.isRecurring && o.eventId === "e1")).toBe(true);
    expect(r[0].occurrenceEnd.toISOString()).toBe("2026-10-12T19:00:00.000Z");
    expect(new Set(r.map((o) => o.occurrenceKey)).size).toBe(3);
  });

  it("does not produce occurrences before the series start", () => {
    const r = expandEvent(weekly, d("2026-09-01T00:00:00Z"), d("2026-10-13T00:00:00Z"));
    expect(starts(r)).toEqual(["2026-10-05T18:00:00.000Z", "2026-10-12T18:00:00.000Z"]);
  });

  it("respects COUNT", () => {
    const c = { ...weekly, rrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=2" };
    expect(expandEvent(c, d("2026-10-01T00:00:00Z"), d("2026-12-31T00:00:00Z"))).toHaveLength(2);
  });

  it("respects UNTIL", () => {
    const u = { ...weekly, rrule: "FREQ=WEEKLY;BYDAY=MO;UNTIL=20261019T000000Z" };
    const r = expandEvent(u, d("2026-10-01T00:00:00Z"), d("2026-12-31T00:00:00Z"));
    expect(starts(r)).toEqual(["2026-10-05T18:00:00.000Z", "2026-10-12T18:00:00.000Z"]);
  });

  it("includes an occurrence that started before `from` and is still running", () => {
    const r = expandEvent(weekly, d("2026-10-12T18:30:00Z"), d("2026-10-12T20:00:00Z"));
    expect(starts(r)).toEqual(["2026-10-12T18:00:00.000Z"]);
  });

  it("caps runaway rules", () => {
    const minutely = ev({ startsAt: d("2026-01-01T00:00:00Z"), rrule: "FREQ=MINUTELY" });
    const r = expandEvent(minutely, d("2026-01-01T00:00:00Z"), d("2026-02-01T00:00:00Z"), {
      maxOccurrences: 50,
    });
    expect(r).toHaveLength(50);
  });

  it("falls back to the single base occurrence on an invalid stored rule", () => {
    const bad = { ...weekly, rrule: "NOT A RULE" };
    expect(expandEvent(bad, d("2026-10-01T00:00:00Z"), d("2026-12-31T00:00:00Z"))).toHaveLength(1);
  });

  it("keeps local wall-clock time across DST when a time zone is given", () => {
    // 18:00 in Toronto: EDT (UTC-4) before Nov 1 2026, EST (UTC-5) after.
    const tor = ev({
      startsAt: d("2026-10-26T22:00:00Z"), // Mon 18:00 EDT
      endsAt: d("2026-10-26T23:00:00Z"),
      rrule: "FREQ=WEEKLY;BYDAY=MO",
    });
    const r = expandEvent(tor, d("2026-10-26T00:00:00Z"), d("2026-11-10T00:00:00Z"), {
      timeZone: "America/Toronto",
    });
    expect(starts(r)).toEqual([
      "2026-10-26T22:00:00.000Z",
      "2026-11-02T23:00:00.000Z",
      "2026-11-09T23:00:00.000Z",
    ]);
    // Without tz the rule is evaluated in UTC (fixed offset).
    const utc = expandEvent(tor, d("2026-10-26T00:00:00Z"), d("2026-11-10T00:00:00Z"));
    expect(starts(utc)[1]).toBe("2026-11-02T22:00:00.000Z");
  });
});

describe("expandEvent — all-day", () => {
  it("defaults a missing endsAt to one day", () => {
    const a = ev({ startsAt: d("2026-10-20T00:00:00Z"), allDay: true });
    const r = expandEvent(a, d("2026-10-20T12:00:00Z"), d("2026-10-20T13:00:00Z"));
    expect(r).toHaveLength(1);
    expect(r[0].occurrenceEnd.getTime() - r[0].occurrenceStart.getTime()).toBe(DAY_MS);
  });

  it("handles multi-day all-day events overlapping the range start", () => {
    const a = ev({ startsAt: d("2026-10-18T00:00:00Z"), endsAt: d("2026-10-21T00:00:00Z"), allDay: true });
    expect(expandEvent(a, d("2026-10-20T00:00:00Z"), d("2026-10-27T00:00:00Z"))).toHaveLength(1);
    expect(expandEvent(a, d("2026-10-21T00:00:00Z"), d("2026-10-27T00:00:00Z"))).toHaveLength(0);
  });

  it("expands recurring all-day events in UTC regardless of tz", () => {
    const a = ev({
      startsAt: d("2026-10-01T00:00:00Z"),
      allDay: true,
      rrule: "FREQ=MONTHLY;BYMONTHDAY=1",
    });
    const r = expandEvent(a, d("2026-10-15T00:00:00Z"), d("2027-01-15T00:00:00Z"), {
      timeZone: "America/Toronto",
    });
    expect(starts(r)).toEqual([
      "2026-11-01T00:00:00.000Z",
      "2026-12-01T00:00:00.000Z",
      "2027-01-01T00:00:00.000Z",
    ]);
    expect(r.every((o) => o.allDay)).toBe(true);
  });
});

describe("expandEvents", () => {
  it("merges and sorts occurrences, all-day first on ties", () => {
    const r = expandEvents(
      [
        ev({ id: "timed", startsAt: d("2026-10-20T00:00:00Z"), endsAt: d("2026-10-20T01:00:00Z") }),
        ev({ id: "allday", startsAt: d("2026-10-20T00:00:00Z"), allDay: true }),
        ev({ id: "early", startsAt: d("2026-10-19T09:00:00Z"), rrule: "FREQ=DAILY;COUNT=1" }),
      ],
      d("2026-10-19T00:00:00Z"),
      d("2026-10-21T00:00:00Z"),
    );
    expect(r.map((o) => o.eventId)).toEqual(["early", "allday", "timed"]);
  });
});

describe("time-zone helpers", () => {
  it("round-trips floating time", () => {
    const instant = d("2026-07-01T16:30:00Z");
    const f = toFloating(instant, "America/Toronto");
    expect(f.toISOString()).toBe("2026-07-01T12:30:00.000Z");
    expect(fromFloating(f, "America/Toronto").toISOString()).toBe(instant.toISOString());
  });
});

describe("normalizeAllDayRange", () => {
  it("floors start, ceils end, and defaults to 1 day", () => {
    expect(normalizeAllDayRange(d("2026-10-20T15:00:00Z"), null)).toEqual({
      startsAt: d("2026-10-20T00:00:00Z"),
      endsAt: d("2026-10-21T00:00:00Z"),
    });
    expect(normalizeAllDayRange(d("2026-10-20T00:00:00Z"), d("2026-10-22T00:00:00Z")).endsAt).toEqual(
      d("2026-10-22T00:00:00Z"),
    );
    expect(normalizeAllDayRange(d("2026-10-20T00:00:00Z"), d("2026-10-21T10:00:00Z")).endsAt).toEqual(
      d("2026-10-22T00:00:00Z"),
    );
    expect(normalizeAllDayRange(d("2026-10-20T00:00:00Z"), d("2026-10-20T00:00:00Z")).endsAt).toEqual(
      d("2026-10-21T00:00:00Z"),
    );
  });
});
