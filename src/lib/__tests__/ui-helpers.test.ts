import { describe, expect, it } from "vitest";
import {
  allDayToForm,
  dayKey,
  dueState,
  formatOccurrenceTime,
  monthGridRange,
  nextDayKey,
  occurrenceDayKeys,
  parseDayKey,
  todoDueFromForm,
  todoDueToForm,
  weekRange,
  zonedInstant,
} from "@/lib/dates";
import { extractInviteToken } from "@/lib/invite-token";
import { initials, readableOn, toFamilyMember } from "@/lib/members";
import { presetToRRule, rruleToPreset } from "@/lib/recurrence-presets";
import { isValidRRule } from "@/lib/recurrence";
import { t } from "@/lib/i18n";

const TZ = "America/Toronto";

describe("dates", () => {
  it("parses day keys at local midnight", () => {
    const d = parseDayKey("2026-10-17", TZ)!;
    expect(new Date(d.getTime()).toISOString()).toBe("2026-10-17T04:00:00.000Z");
    expect(parseDayKey("2026-02-30", TZ)).toBeNull();
    expect(parseDayKey("nope", TZ)).toBeNull();
  });

  it("builds zoned instants across DST", () => {
    expect(zonedInstant("2026-07-01", "18:00", TZ)!.toISOString()).toBe("2026-07-01T22:00:00.000Z");
    expect(zonedInstant("2026-12-01", "18:00", TZ)!.toISOString()).toBe("2026-12-01T23:00:00.000Z");
  });

  it("month grid covers whole weeks starting Sunday", () => {
    const { from, to } = monthGridRange(parseDayKey("2026-10-17", TZ)!, TZ);
    expect(dayKey(from, TZ)).toBe("2026-09-27");
    expect(dayKey(to, TZ)).toBe("2026-11-01");
    const w = weekRange(parseDayKey("2026-10-17", TZ)!, TZ);
    expect(dayKey(w.from, TZ)).toBe("2026-10-11");
    expect(dayKey(w.to, TZ)).toBe("2026-10-18");
  });

  it("buckets all-day events in UTC with exclusive end", () => {
    const occ = {
      allDay: true,
      occurrenceStart: new Date("2026-10-17T00:00:00Z"),
      occurrenceEnd: new Date("2026-10-19T00:00:00Z"),
    };
    expect(occurrenceDayKeys(occ, TZ)).toEqual(["2026-10-17", "2026-10-18"]);
    expect(formatOccurrenceTime(occ, TZ)).toBe("Oct 17 – Oct 18");
  });

  it("buckets timed events in the household zone", () => {
    const occ = {
      allDay: false,
      occurrenceStart: new Date("2026-10-18T02:30:00Z"), // Oct 17, 10:30 p.m. Toronto
      occurrenceEnd: new Date("2026-10-18T04:00:00Z"), // midnight: does not spill to the 18th
    };
    expect(occurrenceDayKeys(occ, TZ)).toEqual(["2026-10-17"]);
  });

  it("round-trips all-day form ranges", () => {
    expect(allDayToForm(new Date("2026-10-17T00:00:00Z"), new Date("2026-10-20T00:00:00Z"))).toEqual({
      startDate: "2026-10-17",
      endDate: "2026-10-19",
    });
    expect(nextDayKey("2026-12-31")).toBe("2027-01-01");
  });

  it("stores date-only todo due dates at end of day", () => {
    const due = todoDueFromForm("2026-10-17", "", TZ)!;
    expect(todoDueToForm(due, TZ)).toEqual({ date: "2026-10-17", time: "" });
    const timed = todoDueFromForm("2026-10-17", "16:30", TZ)!;
    expect(todoDueToForm(timed, TZ)).toEqual({ date: "2026-10-17", time: "16:30" });
    const now = new Date("2026-10-17T14:00:00Z");
    expect(dueState(due, now, TZ)).toBe("today");
    expect(dueState(new Date("2026-10-16T14:00:00Z"), now, TZ)).toBe("overdue");
    expect(dueState(todoDueFromForm("2026-10-18", "", TZ)!, now, TZ)).toBe("tomorrow");
  });
});

describe("recurrence presets", () => {
  it("maps presets to valid rules and back", () => {
    for (const p of ["daily", "weekly", "biweekly", "monthly"] as const) {
      const rule = presetToRRule(p)!;
      expect(isValidRRule(rule)).toBe(true);
      expect(rruleToPreset(rule)).toBe(p);
    }
    expect(presetToRRule("none")).toBeNull();
    expect(rruleToPreset(null)).toBe("none");
    expect(rruleToPreset("RRULE:FREQ=WEEKLY;INTERVAL=1")).toBe("weekly");
    expect(rruleToPreset("FREQ=WEEKLY;BYDAY=MO,WE")).toBe("custom");
    expect(rruleToPreset("FREQ=YEARLY")).toBe("custom");
  });
});

describe("members", () => {
  it("derives names, initials and colours", () => {
    const m = toFamilyMember({
      userId: "u1",
      role: "child",
      color: null,
      displayName: null,
      name: "Maëlle Tremblay",
      email: "m@example.com",
      image: null,
    });
    expect(m.name).toBe("Maëlle Tremblay");
    expect(initials(m.name)).toBe("MT");
    expect(initials("Jean-François")).toBe("JF");
    expect(m.colorIsDefault).toBe(true);
    expect(m.color).toMatch(/^#/);
    expect(readableOn("#d9a400")).toBe("#1d2b33");
    expect(readableOn("#5b5fc7")).toBe("#ffffff");
  });
});

describe("invite links", () => {
  const token = "abcDEF0123456789_-xyzABCDEFGHIJKLMNOPQRSTUV";
  it("accepts full URLs and bare tokens", () => {
    expect(extractInviteToken(`https://family.example/invite/${token}`)).toBe(token);
    expect(extractInviteToken(`  ${token} `)).toBe(token);
    expect(extractInviteToken("https://example.com/hello")).toBeNull();
    expect(extractInviteToken("short")).toBeNull();
  });
});

describe("i18n", () => {
  it("interpolates", () => {
    expect(t("invite.body", { household: "Les Tremblay", role: "an adult" })).toBe("Join Les Tremblay as an adult.");
  });
});
