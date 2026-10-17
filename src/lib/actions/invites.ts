"use server";

import type { Invite, MemberRole } from "@/lib/db/schema";
import { resolveHousehold } from "@/lib/services/context";
import * as inviteService from "@/lib/services/invites";
import { inviteCreateSchema, inviteTokenSchema } from "@/lib/validators";
import {
  formToObject,
  parse,
  resolveHouseholdFromInput,
  revalidate,
  revalidateApp,
  ROUTES,
  run,
  setActiveHouseholdCookie,
  type ActionResult,
} from "./_utils";

/**
 * Creates an invite (owner only). Token: 32 random bytes base64url; expires in 7 days.
 * `householdId` defaults to the active household. Returns the invite with its `url`.
 */
export async function createInvite(
  input: { householdId?: string; email: string; role?: MemberRole } | FormData,
): Promise<ActionResult<Invite & { url: string }>> {
  return run(async () => {
    const ctx = await resolveHouseholdFromInput(input);
    const obj = formToObject(input) as Record<string, unknown>;
    const data = parse(inviteCreateSchema, { ...obj, householdId: ctx.member.householdId });
    const invite = await inviteService.createInvite(ctx, data);
    revalidate(ROUTES.settings);
    return invite;
  });
}

/** Revokes (deletes) a pending invite (owner only). */
export async function revokeInvite(householdId: string, inviteId: string): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await resolveHousehold(householdId);
    const result = await inviteService.revokeInvite(ctx, inviteId);
    revalidate(ROUTES.settings);
    return result;
  });
}

/**
 * Accepts an invite for the signed-in user (email must match the invite). Adds the
 * membership, marks the invite accepted, and makes that household active.
 */
export async function acceptInvite(
  token: string,
): Promise<ActionResult<{ householdId: string; role: MemberRole }>> {
  return run(async () => {
    const t = inviteTokenSchema.parse(token);
    const result = await inviteService.acceptInvite(t);
    await setActiveHouseholdCookie(result.householdId);
    revalidateApp();
    return result;
  });
}
