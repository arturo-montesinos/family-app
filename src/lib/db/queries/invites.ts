import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { householdMembers, invites, users, type Invite, type MemberRole } from "@/lib/db/schema";

export async function createInvite(
  householdId: string,
  input: { email: string; role: MemberRole; token: string; invitedBy: string; expiresAt: Date },
): Promise<Invite> {
  const [row] = await db
    .insert(invites)
    .values({ householdId, ...input })
    .returning();
  return row;
}

/** Pending (not accepted, not expired) invites, newest first. */
export async function listPendingInvites(householdId: string, now = new Date()): Promise<Invite[]> {
  return db
    .select()
    .from(invites)
    .where(
      and(eq(invites.householdId, householdId), isNull(invites.acceptedAt), gt(invites.expiresAt, now)),
    )
    .orderBy(desc(invites.expiresAt));
}

/** Token lookup is necessarily global (the token is the capability). */
export async function getInviteByToken(token: string): Promise<Invite | null> {
  const [row] = await db.select().from(invites).where(eq(invites.token, token)).limit(1);
  return row ?? null;
}

/** Deletes the invite; returns its id + email (for the audit log), or null if not found. */
export async function revokeInvite(
  householdId: string,
  inviteId: string,
): Promise<{ id: string; email: string } | null> {
  const [row] = await db
    .delete(invites)
    .where(and(eq(invites.householdId, householdId), eq(invites.id, inviteId)))
    .returning({ id: invites.id, email: invites.email });
  return row ?? null;
}

/** Marks an invite accepted (only if still pending). Returns false when it was already used. */
export async function markInviteAccepted(householdId: string, inviteId: string): Promise<boolean> {
  const rows = await db
    .update(invites)
    .set({ acceptedAt: new Date() })
    .where(and(eq(invites.householdId, householdId), eq(invites.id, inviteId), isNull(invites.acceptedAt)))
    .returning({ id: invites.id });
  return rows.length > 0;
}

/** True if a user with this email (case-insensitive) is already a member. */
export async function isEmailMember(householdId: string, email: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: householdMembers.userId })
    .from(householdMembers)
    .innerJoin(users, eq(users.id, householdMembers.userId))
    .where(and(eq(householdMembers.householdId, householdId), sql`lower(${users.email}) = ${email.toLowerCase()}`))
    .limit(1);
  return Boolean(row);
}

/**
 * Atomically consumes a pending, unexpired invite and adds `userId` as a member with the
 * invite's role — in ONE statement (data-modifying CTE), so two concurrent accepts can't
 * both succeed. Returns the household id + role, or null if the invite was no longer valid.
 * If the user is already a member, the invite is still consumed and their role is kept.
 */
export async function consumeInviteAndAddMember(
  inviteId: string,
  userId: string,
  now = new Date(),
): Promise<{ householdId: string; role: MemberRole } | null> {
  const result = await db.execute<{ household_id: string; role: MemberRole }>(sql`
    with accepted as (
      update ${invites}
         set accepted_at = ${now.toISOString()}::timestamptz
       where ${invites.id} = ${inviteId}
         and ${invites.acceptedAt} is null
         and ${invites.expiresAt} > ${now.toISOString()}::timestamptz
      returning ${invites.householdId} as household_id, ${invites.role} as role
    ), inserted as (
      insert into ${householdMembers} (household_id, user_id, role)
      select household_id, ${userId}, role from accepted
      on conflict do nothing
    )
    select household_id, role from accepted
  `);
  const row = result.rows[0];
  return row ? { householdId: row.household_id, role: row.role } : null;
}
