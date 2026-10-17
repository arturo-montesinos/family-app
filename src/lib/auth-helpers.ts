import "server-only";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { householdMembers, users, type HouseholdMember, type User } from "@/lib/db/schema";

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "Not signed in") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Not a member of this household") {
    super(message);
    this.name = "ForbiddenError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!UUID_RE.test(householdId)) throw new ForbiddenError();

  const [member] = await db
    .select()
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, user.id)))
    .limit(1);

  if (!member) throw new ForbiddenError();
  return { user, member };
}
