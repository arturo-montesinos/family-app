import { describe, expect, it } from "vitest";
import {
  eventCreateSchema,
  eventRangeSchema,
  eventUpdateSchema,
  householdCreateSchema,
  inviteCreateSchema,
  memberUpdateSchema,
  postCreateSchema,
  postUpdateSchema,
  todoCreateSchema,
  todoUpdateSchema,
} from "@/lib/validators";

const HH = "8b0f7e0c-3c56-4c8e-9d6f-1a2b3c4d5e6f";

describe("household", () => {
  it("trims and requires a name", () => {
    expect(householdCreateSchema.parse({ name: "  Famille  " }).name).toBe("Famille");
    expect(householdCreateSchema.safeParse({ name: "   " }).success).toBe(false);
  });
  it("member update requires at least one field and validates colors", () => {
    expect(memberUpdateSchema.safeParse({}).success).toBe(false);
    expect(memberUpdateSchema.parse({ color: "#ABCDEF" }).color).toBe("#abcdef");
    expect(memberUpdateSchema.parse({ color: "" }).color).toBeNull();
    expect(memberUpdateSchema.safeParse({ color: "blue" }).success).toBe(false);
    expect(memberUpdateSchema.safeParse({ role: "admin" }).success).toBe(false);
  });
});

describe("invite", () => {
  it("normalizes email and defaults role to adult", () => {
    const r = inviteCreateSchema.parse({ householdId: HH, email: "  Bob@Example.COM " });
    expect(r).toEqual({ householdId: HH, email: "bob@example.com", role: "adult" });
  });
  it("rejects bad email, role and household id", () => {
    expect(inviteCreateSchema.safeParse({ householdId: HH, email: "nope" }).success).toBe(false);
    expect(inviteCreateSchema.safeParse({ householdId: HH, email: "a@b.co", role: "god" }).success).toBe(false);
    expect(inviteCreateSchema.safeParse({ householdId: "x", email: "a@b.co" }).success).toBe(false);
  });
});

describe("event", () => {
  const base = {
    title: "Soccer",
    startsAt: "2026-10-20T18:00:00.000Z",
    endsAt: "2026-10-20T19:00:00.000Z",
  };

  it("coerces ISO strings to Date and applies defaults", () => {
    const r = eventCreateSchema.parse(base);
    expect(r.startsAt).toBeInstanceOf(Date);
    expect(r.startsAt.toISOString()).toBe(base.startsAt);
    expect(r.endsAt).toBeInstanceOf(Date);
    expect(r.allDay).toBe(false);
    expect(r.attendeeIds).toEqual([]);
  });

  it("treats empty form strings as null and accepts form booleans", () => {
    const r = eventCreateSchema.parse({ ...base, endsAt: "", description: "", rrule: "", allDay: "on" });
    expect(r.endsAt).toBeNull();
    expect(r.description).toBeNull();
    expect(r.rrule).toBeNull();
    expect(r.allDay).toBe(true);
  });

  it("validates rrule", () => {
    expect(eventCreateSchema.parse({ ...base, rrule: "FREQ=WEEKLY;BYDAY=TU" }).rrule).toBe("FREQ=WEEKLY;BYDAY=TU");
    expect(eventCreateSchema.safeParse({ ...base, rrule: "every tuesday" }).success).toBe(false);
  });

  it("rejects end before start and invalid dates", () => {
    const r = eventCreateSchema.safeParse({ ...base, endsAt: "2026-10-20T17:00:00.000Z" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["endsAt"]);
    expect(eventCreateSchema.safeParse({ ...base, startsAt: "not a date" }).success).toBe(false);
  });

  it("accepts a single attendee id string (form) as an array", () => {
    expect(eventCreateSchema.parse({ ...base, attendeeIds: "u1" }).attendeeIds).toEqual(["u1"]);
  });

  it("update is partial but not empty", () => {
    expect(eventUpdateSchema.safeParse({}).success).toBe(false);
    expect(eventUpdateSchema.parse({ title: "New" })).toMatchObject({ title: "New" });
    expect(eventUpdateSchema.parse({ rrule: null }).rrule).toBeNull();
  });

  it("range requires to > from and caps size", () => {
    expect(eventRangeSchema.parse({ from: "2026-10-01", to: "2026-11-01" }).from).toBeInstanceOf(Date);
    expect(eventRangeSchema.safeParse({ from: "2026-11-01", to: "2026-10-01" }).success).toBe(false);
    expect(eventRangeSchema.safeParse({ from: "2026-01-01", to: "2028-01-01" }).success).toBe(false);
    expect(eventRangeSchema.safeParse({ from: "2026-10-01", to: "2026-11-01", tz: "Mars/Olympus" }).success).toBe(false);
    expect(eventRangeSchema.parse({ from: "2026-10-01", to: "2026-11-01", tz: "America/Toronto" }).tz).toBe(
      "America/Toronto",
    );
  });
});

describe("todo", () => {
  it("defaults status and coerces dueAt", () => {
    const r = todoCreateSchema.parse({ title: "Groceries", dueAt: "2026-10-21T12:00:00Z" });
    expect(r.status).toBe("open");
    expect(r.dueAt).toBeInstanceOf(Date);
  });
  it("empty assignee/due → null; invalid status rejected", () => {
    const r = todoCreateSchema.parse({ title: "x", assignedTo: "", dueAt: "" });
    expect(r.assignedTo).toBeNull();
    expect(r.dueAt).toBeNull();
    expect(todoCreateSchema.safeParse({ title: "x", status: "pending" }).success).toBe(false);
    expect(todoCreateSchema.safeParse({ title: "" }).success).toBe(false);
  });
  it("update requires a field", () => {
    expect(todoUpdateSchema.safeParse({}).success).toBe(false);
    expect(todoUpdateSchema.parse({ status: "done" }).status).toBe("done");
  });
});

describe("post", () => {
  it("requires body, defaults pinned=false", () => {
    expect(postCreateSchema.parse({ body: " hi " })).toEqual({ body: "hi", pinned: false });
    expect(postCreateSchema.safeParse({ body: "" }).success).toBe(false);
    expect(postCreateSchema.parse({ body: "x", pinned: "true" }).pinned).toBe(true);
  });
  it("update requires a field", () => {
    expect(postUpdateSchema.safeParse({}).success).toBe(false);
    expect(postUpdateSchema.parse({ pinned: false }).pinned).toBe(false);
  });
});
