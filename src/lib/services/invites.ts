import "server-only";
import { requireUser } from "@/lib/auth-helpers";
import * as householdQueries from "@/lib/db/queries/households";
import * as inviteQueries from "@/lib/db/queries/invites";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { assertAllowed, assertCan, canInviteRole } from "@/lib/permissions";
import type { InviteCreateInput } from "@/lib/validators";
import { audit, recordAudit } from "./audit";
import { actorOf, type HouseholdCtx } from "./context";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 32 random bytes, base64url (43 chars). */
export function generateInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("base64url");
}

export function inviteUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${base}/invite/${token}`;
}

export async function createInvite(ctx: HouseholdCtx, input: Omit<InviteCreateInput, "householdId">) {
  assertCan(actorOf(ctx), "invite:manage");
  assertAllowed(canInviteRole(actorOf(ctx), input.role), "Invites can't make someone an owner");
  const householdId = ctx.member.householdId;
  if (await inviteQueries.isEmailMember(householdId, input.email)) {
    throw new ConflictError("That person is already a member");
  }
  const token = generateInviteToken();
  const invite = await inviteQueries.createInvite(householdId, {
    email: input.email,
    role: input.role,
    token,
    invitedBy: ctx.user.id,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });
  // TODO: email the link via Resend (AUTH_RESEND_KEY) — for now the UI shows/copies it.
  await audit(ctx, "invite.create", { entityId: invite.id, summary: invite.email, metadata: { role: invite.role } });
  return { ...invite, url: inviteUrl(token) };
}

export async function listInvites(ctx: HouseholdCtx) {
  assertCan(actorOf(ctx), "invite:manage");
  return inviteQueries.listPendingInvites(ctx.member.householdId);
}

export async function revokeInvite(ctx: HouseholdCtx, inviteId: string) {
  assertCan(actorOf(ctx), "invite:manage");
  const revoked = await inviteQueries.revokeInvite(ctx.member.householdId, inviteId);
  if (!revoked) throw new NotFoundError("Invite not found");
  await audit(ctx, "invite.revoke", { entityId: inviteId, summary: revoked.email });
  return { id: inviteId };
}

export type InviteStatus = "pending" | "accepted" | "expired";

/** Public-ish preview for /invite/[token] (no auth needed to show who invited you where). */
export async function getInviteDetails(token: string) {
  const invite = await inviteQueries.getInviteByToken(token);
  if (!invite) return null;
  const household = await householdQueries.getHousehold(invite.householdId);
  if (!household) return null;
  const status: InviteStatus = invite.acceptedAt
    ? "accepted"
    : invite.expiresAt.getTime() <= Date.now()
      ? "expired"
      : "pending";
  return {
    householdId: household.id,
    householdName: household.name,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
    status,
  };
}

/**
 * Accepts an invite for the signed-in user. The user's email must match the invite email
 * (case-insensitive). Atomic: the invite is consumed and the membership created in one
 * statement. Accepting an invite to a household you're already in just consumes it.
 */
export async function acceptInvite(token: string) {
  const user = await requireUser({ throwOnMissing: true });
  const invite = await inviteQueries.getInviteByToken(token);
  if (!invite) throw new NotFoundError("Invite not found");
  if (invite.acceptedAt) throw new ConflictError("This invite has already been used");
  if (invite.expiresAt.getTime() <= Date.now()) throw new ConflictError("This invite has expired");
  if (!user.email || user.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new ForbiddenError(`This invite was sent to ${invite.email}. Sign in with that address to accept it.`);
  }
  const result = await inviteQueries.consumeInviteAndAddMember(invite.id, user.id);
  if (!result) throw new ConflictError("This invite is no longer valid");
  await recordAudit({
    householdId: result.householdId,
    actorUserId: user.id,
    action: "invite.accept",
    details: { entityId: invite.id, summary: invite.email, metadata: { role: result.role } },
  });
  return result;
}
