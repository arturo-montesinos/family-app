import { z } from "zod";
import { uuid } from "./common";
import { memberRoleSchema } from "./household";

export const inviteCreateSchema = z.object({
  householdId: uuid,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: "Invalid email address" })),
  role: memberRoleSchema.default("adult"),
});

export const inviteTokenSchema = z.string().trim().min(16, "Invalid invite").max(128);

export type InviteCreateInput = z.output<typeof inviteCreateSchema>;
