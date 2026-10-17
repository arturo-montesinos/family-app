import "server-only";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { householdMembers, users, type HouseholdMember, type User } from "@/lib/db/schema";
import { ForbiddenError, UnauthorizedError, isUuid } from "@/lib/errors";

export { UnauthorizedError, ForbiddenError } from "@/lib/errors";

/** Current user from the database session, or null. Never redirects/throws. */
export async function getCurrentUser(): Promise<User | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

/**
 * Pages / server actions: returns the signed-in user, or redirects to /signin.
 * Pass `{ throwOnMissing: true }` from route handlers to get an UnauthorizedError instead.
 */
export async function requireUser(opts?: { throwOnMissing?: boolean }): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    if (opts?.throwOnMissing) throw new UnauthorizedError();
    redirect("/signin");
  }
  return user;
}

/**
 * Asserts the signed-in user is a member of `householdId`.
 * Throws ForbiddenError when not a member (map to 403 / notFound() in callers).
 */
export async function requireHousehold(
  householdId: string,
  opts?: { throwOnMissing?: boolean },
): Promise<{ user: User; member: HouseholdMember }> {
  const user = await requireUser(opts);
  if (!isUuid(householdId)) throw new ForbiddenError();

  const [member] = await db
    .select()
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, user.id)))
    .limit(1);

  if (!member) throw new ForbiddenError();
  return { user, member };
}
