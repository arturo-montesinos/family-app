import { z } from "zod";
import { hexColor, nullableColor, nullableText, nonEmpty, NON_EMPTY_MESSAGE, uuid } from "./common";

export const memberRoleSchema = z.enum(["owner", "adult", "child"]);

const householdName = z.string().trim().min(1, "Name is required").max(80);

export const householdCreateSchema = z.object({
  name: householdName,
  /** Optional color / display name for the creating owner. */
  color: hexColor.optional(),
  displayName: z.string().trim().min(1).max(60).optional(),
});

export const householdUpdateSchema = z.object({
  name: householdName,
});

export const setActiveHouseholdSchema = z.object({
  householdId: uuid,
});

export const memberUpdateSchema = z
  .object({
    role: memberRoleSchema.optional(),
    color: nullableColor,
    displayName: nullableText(60),
  })
  .refine(nonEmpty, { message: NON_EMPTY_MESSAGE });

export type HouseholdCreateInput = z.output<typeof householdCreateSchema>;
export type HouseholdUpdateInput = z.output<typeof householdUpdateSchema>;
export type SetActiveHouseholdInput = z.output<typeof setActiveHouseholdSchema>;
export type MemberUpdateInput = z.output<typeof memberUpdateSchema>;
