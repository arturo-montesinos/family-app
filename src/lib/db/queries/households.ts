import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  householdMembers,
  households,
  type Household,
  type HouseholdMember,
  type MemberRole,
} from "@/lib/db/schema";

export type HouseholdWithRole = Household & {
  role: MemberRole;
  color: string | null;
  displayName: string | null;
  joinedAt: Date;
};

export async function getHousehold(householdId: string): Promise<Household | null> {
  const [row] = await db.select().from(households).where(eq(households.id, householdId)).limit(1);
  return row ?? null;
}

/** Households the user belongs to (for the switcher), oldest membership first. */
export async function listHouseholdsForUser(userId: string): Promise<HouseholdWithRole[]> {
  return db
    .select({
      id: households.id,
      name: households.name,
      createdAt: households.createdAt,
      role: householdMembers.role,
      color: householdMembers.color,
      displayName: householdMembers.displayName,
      joinedAt: householdMembers.joinedAt,
    })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .where(eq(householdMembers.userId, userId))
    .orderBy(asc(householdMembers.joinedAt), asc(households.name));
}

/** Atomically creates a household and its first (owner) member. */
export async function createHouseholdWithOwner(input: {
  name: string;
  ownerId: string;
  color?: string | null;
  displayName?: string | null;
}): Promise<{ household: Household; member: HouseholdMember }> {
  const id = crypto.randomUUID();
  const [[household], [member]] = await db.batch([
    db.insert(households).values({ id, name: input.name }).returning(),
    db
      .insert(householdMembers)
      .values({
        householdId: id,
        userId: input.ownerId,
        role: "owner",
        color: input.color ?? null,
        displayName: input.displayName ?? null,
      })
      .returning(),
  ]);
  return { household, member };
}

export async function updateHousehold(
  householdId: string,
  patch: { name?: string },
): Promise<Household | null> {
  const [row] = await db
    .update(households)
    .set(patch)
    .where(eq(households.id, householdId))
    .returning();
  return row ?? null;
}

export async function deleteHousehold(householdId: string): Promise<boolean> {
  const rows = await db
    .delete(households)
    .where(eq(households.id, householdId))
    .returning({ id: households.id });
  return rows.length > 0;
}
