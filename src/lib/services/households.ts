import "server-only";
import { requireUser } from "@/lib/auth-helpers";
import * as householdQueries from "@/lib/db/queries/households";
import * as memberQueries from "@/lib/db/queries/members";
import type { MemberRole } from "@/lib/db/schema";
import { countHouseholds, isAdminEmail } from "@/lib/access";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import {
  assertAllowed,
  assertCan,
  canChangeRole,
  canRemoveMember,
  canUpdateMemberProfile,
} from "@/lib/permissions";
import type { HouseholdCreateInput, HouseholdUpdateInput, MemberUpdateInput } from "@/lib/validators";
import { audit, recordAudit } from "./audit";
import { actorOf, type HouseholdCtx } from "./context";

export async function listMyHouseholds() {
  const user = await requireUser({ throwOnMissing: true });
  return householdQueries.listHouseholdsForUser(user.id);
}

export async function createHousehold(input: HouseholdCreateInput) {
  const user = await requireUser({ throwOnMissing: true });
  if (!isAdminEmail(user.email)) {
    throw new ForbiddenError("Only the administrator can set up the household. Ask them for an invite.");
  }
  if ((await countHouseholds()) > 0) {
    throw new ConflictError("The household is already set up.");
  }
  const result = await householdQueries.createHouseholdWithOwner({
    name: input.name,
    ownerId: user.id,
    color: input.color ?? null,
    displayName: input.displayName ?? user.name ?? null,
  });
  await recordAudit({
    householdId: result.household.id,
    actorUserId: user.id,
    action: "household.create",
    details: { entityId: result.household.id, summary: result.household.name },
  });
  return result;
}

export async function getHousehold(ctx: HouseholdCtx) {
  const household = await householdQueries.getHousehold(ctx.member.householdId);
  if (!household) throw new NotFoundError("Household not found");
  return household;
}

export async function updateHousehold(ctx: HouseholdCtx, input: HouseholdUpdateInput) {
  assertCan(actorOf(ctx), "household:update");
  const row = await householdQueries.updateHousehold(ctx.member.householdId, input);
  if (!row) throw new NotFoundError("Household not found");
  await audit(ctx, "household.update", { entityId: row.id, summary: row.name });
  return row;
}

export async function deleteHousehold(ctx: HouseholdCtx) {
  assertCan(actorOf(ctx), "household:delete");
  await householdQueries.deleteHousehold(ctx.member.householdId);
  return { id: ctx.member.householdId };
}

export function listMembers(ctx: HouseholdCtx) {
  return memberQueries.listMembers(ctx.member.householdId);
}

async function loadTarget(ctx: HouseholdCtx, userId: string) {
  const target =
    userId === ctx.user.id ? ctx.member : await memberQueries.getMember(ctx.member.householdId, userId);
  if (!target) throw new NotFoundError("Member not found");
  return target;
}

/**
 * Updates role and/or color/displayName. Role: owner only, never demoting the last owner.
 * Color/displayName: self or owner.
 */
export async function updateMember(ctx: HouseholdCtx, userId: string, input: MemberUpdateInput) {
  const householdId = ctx.member.householdId;
  const actor = actorOf(ctx);
  const target = await loadTarget(ctx, userId);

  if (input.role !== undefined && input.role !== target.role) {
    const owners = await memberQueries.countOwners(householdId);
    if (actor.role !== "owner") throw new ForbiddenError("Only the household owner can change roles");
    assertAllowed(
      canChangeRole(actor, target, input.role as MemberRole, owners),
      "A household needs at least one owner",
    );
  }
  if (input.color !== undefined || input.displayName !== undefined) {
    assertAllowed(canUpdateMemberProfile(actor, target), "You can only change your own profile");
  }

  const row = await memberQueries.updateMember(householdId, userId, {
    role: input.role,
    color: input.color,
    displayName: input.displayName,
  });
  if (!row) throw new NotFoundError("Member not found");
  await audit(ctx, "member.update", {
    entityId: userId,
    summary: row.displayName ?? "",
    metadata: { changed: Object.keys(input).filter((k) => input[k as keyof MemberUpdateInput] !== undefined), role: input.role },
  });
  return row;
}

/** Owner removes a member, or a member leaves. The last owner can't leave/be removed. */
export async function removeMember(ctx: HouseholdCtx, userId: string) {
  const householdId = ctx.member.householdId;
  const actor = actorOf(ctx);
  const target = await loadTarget(ctx, userId);
  const owners = target.role === "owner" ? await memberQueries.countOwners(householdId) : 2;
  if (!canRemoveMember(actor, target, owners)) {
    if (target.role === "owner" && owners <= 1) {
      throw new BadRequestError("The last owner can't leave; transfer ownership or delete the household");
    }
    throw new ForbiddenError("Only the household owner can remove members");
  }
  await memberQueries.removeMember(householdId, userId);
  await audit(ctx, "member.remove", {
    entityId: userId,
    summary: target.displayName ?? "",
    metadata: { left: userId === ctx.user.id },
  });
  return { householdId, userId };
}
