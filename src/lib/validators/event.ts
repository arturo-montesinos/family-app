import { z } from "zod";
import {
  boolish,
  date,
  idArray,
  nonEmpty,
  NON_EMPTY_MESSAGE,
  nullableColor,
  nullableDate,
  nullableRRule,
  nullableText,
} from "./common";

const title = z.string().trim().min(1, "Title is required").max(200);

const endAfterStart = (o: { startsAt?: Date; endsAt?: Date | null }) =>
  !o.startsAt || !o.endsAt || o.endsAt.getTime() >= o.startsAt.getTime();
const END_AFTER_START = { message: "End must be after start", path: ["endsAt"] };

/**
 * All-day events: send `startsAt` as the first day (e.g. "2026-10-20" → UTC midnight) and
 * `endsAt` as the exclusive end (day after the last day) or omit it for a single day.
 * The server normalizes all-day ranges to UTC midnights.
 */
export const eventCreateSchema = z
  .object({
    title,
    description: nullableText(5000),
    location: nullableText(300),
    startsAt: date,
    endsAt: nullableDate,
    allDay: boolish.default(false),
    rrule: nullableRRule,
    color: nullableColor,
    attendeeIds: idArray.default([]),
  })
  .refine(endAfterStart, END_AFTER_START);

export const eventUpdateSchema = z
  .object({
    title: title.optional(),
    description: nullableText(5000),
    location: nullableText(300),
    startsAt: date.optional(),
    endsAt: nullableDate,
    allDay: boolish.optional(),
    rrule: nullableRRule,
    color: nullableColor,
    attendeeIds: idArray.optional(),
  })
  .refine(nonEmpty, { message: NON_EMPTY_MESSAGE })
  .refine(endAfterStart, END_AFTER_START);

const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** Query for range listing: `?from=ISO&to=ISO[&tz=America/Toronto]` (max ~13 months). */
export const eventRangeSchema = z
  .object({
    from: date,
    to: date,
    tz: z.string().trim().refine(isTimeZone, { message: "Unknown time zone" }).optional(),
  })
  .refine((o) => o.to.getTime() > o.from.getTime(), { message: "`to` must be after `from`", path: ["to"] })
  .refine((o) => o.to.getTime() - o.from.getTime() <= 400 * 24 * 60 * 60 * 1000, {
    message: "Range too large (max 400 days)",
    path: ["to"],
  });

export type EventCreateInput = z.output<typeof eventCreateSchema>;
export type EventUpdateInput = z.output<typeof eventUpdateSchema>;
export type EventRangeInput = z.output<typeof eventRangeSchema>;
