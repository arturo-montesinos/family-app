"use server";

import { requireUser } from "@/lib/auth-helpers";
import type { Household, HouseholdMember } from "@/lib/db/schema";
import { getActiveHouseholdId } from "@/lib/household";
import { resolveHousehold } from "@/lib/services/context";
import * as householdService from "@/lib/services/households";
import {
  householdCreateSchema,
  householdUpdateSchema,
  memberRoleSchema,
  memberUpdateSchema,
  setActiveHouseholdSchema,
  type MemberUpdateInput,
} from "@/lib/validators";
import {
  clearActiveHouseholdCookie,
  parse,
  revalidateApp,
  run,
  setActiveHouseholdCookie,
  type ActionResult,
} from "./_utils";

type Input<T> = T | FormData;

/** Creates a household with the current user as owner and makes it active. */
export async function createHousehold(
  input: Input<{ name: string; color?: string; displayName?: string }>,
): Promise<ActionResult<{ household: Household; member: HouseholdMember }>> {
  return run(async () => {
    const data = parse(householdCreateSchema, input);
    const result = await householdService.createHousehold(data);
    await setActiveHouseholdCookie(result.household.id);
    revalidateApp();
    return result;
  });
}

/** Switches the active household (sets the `fa_household` cookie) after checking membership. */
export async function setActiveHousehold(
  input: Input<{ householdId: string }> | string,
): Promise<ActionResult<{ householdId: string }>> {
  return run(async () => {
    const { householdId } = parse(
      setActiveHouseholdSchema,
      typeof input === "string" ? { householdId: input } : input,
    );
    await resolveHousehold(householdId);
    await setActiveHouseholdCookie(householdId);
    revalidateApp();
    return { householdId };
  });
}

/** Renames a household (owner only). */
export async function updateHousehold(
  householdId: string,
  input: Input<{ name: string }>,
): Promise<ActionResult<Household>> {
  return run(async () => {
    const data = parse(householdUpdateSchema, input);
    const ctx = await resolveHousehold(householdId);
    const row = await householdService.updateHousehold(ctx, data);
    revalidateApp();
    return row;
  });
}

/** Deletes a household and everything in it (owner only). */
export async function deleteHousehold(householdId: string): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await resolveHousehold(householdId);
    const result = await householdService.deleteHousehold(ctx);
    if ((await getActiveHouseholdId()) === householdId) await clearActiveHouseholdCookie();
    revalidateApp();
    return result;
  });
}

/** Owner removes a member, or a member removes themselves (leave). */
export async function removeMember(
  householdId: string,
  userId: string,
): Promise<ActionResult<{ householdId: string; userId: string }>> {
  return run(async () => {
    const ctx = await resolveHousehold(householdId);
    const result = await householdService.removeMember(ctx, userId);
    if (userId === ctx.user.id) await clearActiveHouseholdCookie();
    revalidateApp();
    return result;
  });
}

/** Sets a member's color (and optionally display name). Self or owner. Pass null to clear. */
export async function updateMemberColor(
  householdId: string,
  userId: string,
  color: string | null,
  displayName?: string | null,
): Promise<ActionResult<HouseholdMember>> {
  return run(async () => {
    const data = parse(memberUpdateSchema, { color, displayName });
    const ctx = await resolveHousehold(householdId);
    const row = await householdService.updateMember(ctx, userId, data);
    revalidateApp();
    return row;
  });
}

/** Changes a member's role (owner only; the last owner can't be demoted). */
export async function updateMemberRole(
  householdId: string,
  userId: string,
  role: "owner" | "adult" | "child",
): Promise<ActionResult<HouseholdMember>> {
  return run(async () => {
    const data = parse(memberUpdateSchema, { role: memberRoleSchema.parse(role) });
    const ctx = await resolveHousehold(householdId);
    const row = await householdService.updateMember(ctx, userId, data);
    revalidateApp();
    return row;
  });
}

/** Generic member update (role / color / displayName) from a form. */
export async function updateMember(
  householdId: string,
  userId: string,
  input: Input<Partial<MemberUpdateInput>>,
): Promise<ActionResult<HouseholdMember>> {
  return run(async () => {
    const data = parse(memberUpdateSchema, input);
    const ctx = await resolveHousehold(householdId);
    const row = await householdService.updateMember(ctx, userId, data);
    revalidateApp();
    return row;
  });
}

/** Households of the current user (for client-side switchers). */
export async function listMyHouseholds() {
  return run(async () => {
    await requireUser({ throwOnMissing: true });
    return householdService.listMyHouseholds();
  });
}

