import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  householdMembers,
  users,
  type HouseholdMember,
  type MemberRole,
} from "@/lib/db/schema";

export type MemberWithUser = HouseholdMember & {
  name: string | null;
  email: string | null;
  image: string | null;
};

const memberWithUserColumns = {
  householdId: householdMembers.householdId,
  userId: householdMembers.userId,
  role: householdMembers.role,
  color: householdMembers.color,
  displayName: householdMembers.displayName,
  joinedAt: householdMembers.joinedAt,
  name: users.name,
  email: users.email,
  image: users.image,
};

export async function listMembers(householdId: string): Promise<MemberWithUser[]> {
  return db
    .select(memberWithUserColumns)
    .from(householdMembers)
    .innerJoin(users, eq(users.id, householdMembers.userId))
    .where(eq(householdMembers.householdId, householdId))
    .orderBy(asc(householdMembers.joinedAt));
}

export async function getMember(householdId: string, userId: string): Promise<HouseholdMember | null> {
  const [row] = await db
    .select()
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function countMembers(householdId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, householdId));
  return row?.n ?? 0;
}

export async function countOwners(householdId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.role, "owner")));
  return row?.n ?? 0;
}

/** Returns the subset of `userIds` that are members of the household. */
export async function filterMemberIds(householdId: string, userIds: string[]): Promise<string[]> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return [];
  const rows = await db
    .select({ userId: householdMembers.userId })
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), inArray(householdMembers.userId, unique)));
  return rows.map((r) => r.userId);
}

/** Adds a member; no-op (returns null) if already a member. */
export async function addMember(
  householdId: string,
  input: { userId: string; role: MemberRole; color?: string | null; displayName?: string | null },
): Promise<HouseholdMember | null> {
  const [row] = await db
    .insert(householdMembers)
    .values({
      householdId,
      userId: input.userId,
      role: input.role,
      color: input.color ?? null,
      displayName: input.displayName ?? null,
    })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function updateMember(
  householdId: string,
  userId: string,
  patch: { role?: MemberRole; color?: string | null; displayName?: string | null },
): Promise<HouseholdMember | null> {
  const [row] = await db
    .update(householdMembers)
    .set(patch)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
    .returning();
  return row ?? null;
}

export async function removeMember(householdId: string, userId: string): Promise<boolean> {
  const rows = await db
    .delete(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
    .returning({ userId: householdMembers.userId });
  return rows.length > 0;
}
