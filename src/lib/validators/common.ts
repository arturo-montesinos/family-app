import { z } from "zod";
import { isValidRRule } from "@/lib/recurrence";

/** Treats "" (empty form field) as null. */
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const uuid = z.uuid({ message: "Invalid id" });

/** Auth.js user ids are text (random UUIDs, but not guaranteed). */
export const userId = z.string().trim().min(1, "Invalid user id").max(255);

export const hexColor = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex color like #3b82f6")
  .transform((v) => v.toLowerCase());

/** Required date: ISO string / timestamp / Date → Date. */
export const date = z.coerce.date({ message: "Invalid date" });

/** Optional, nullable date; "" → null. */
export const nullableDate = z.preprocess(emptyToNull, z.union([z.null(), date])).optional();

/** Optional, nullable trimmed text; "" → null. */
export const nullableText = (max: number) =>
  z.preprocess(emptyToNull, z.union([z.null(), z.string().trim().max(max)])).optional();

/** Optional, nullable hex color; "" → null. */
export const nullableColor = z.preprocess(emptyToNull, z.union([z.null(), hexColor])).optional();

/** Optional, nullable user id; "" → null. */
export const nullableUserId = z.preprocess(emptyToNull, z.union([z.null(), userId])).optional();

/** Boolean that also accepts form values ("on", "true", "1", "false", "0", ""). */
export const boolish = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const s = v.trim().toLowerCase();
  if (["on", "true", "1", "yes"].includes(s)) return true;
  if (["off", "false", "0", "no", ""].includes(s)) return false;
  return v;
}, z.boolean());

/** RRULE body (e.g. "FREQ=WEEKLY;BYDAY=MO"); "" → null. */
export const nullableRRule = z
  .preprocess(
    emptyToNull,
    z.union([
      z.null(),
      z
        .string()
        .trim()
        .max(500)
        .refine(isValidRRule, { message: "Invalid recurrence rule (RRULE)" }),
    ]),
  )
  .optional();

/** Array of ids; accepts a single string (one form value) too. */
export const idArray = z.preprocess(
  (v) => (typeof v === "string" ? (v === "" ? [] : [v]) : v),
  z.array(userId).max(50),
);

/** Rejects an update payload with no fields. */
export const nonEmpty = (o: Record<string, unknown>) =>
  Object.values(o).some((v) => v !== undefined);
export const NON_EMPTY_MESSAGE = "Nothing to update";
