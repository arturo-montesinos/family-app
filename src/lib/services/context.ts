import "server-only";
import { requireHousehold } from "@/lib/auth-helpers";
import type { HouseholdMember, User } from "@/lib/db/schema";
import { ForbiddenError, NotFoundError, assertUuid } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";

/** Resolved caller in a household: who they are and their membership row. */
export type HouseholdCtx = { user: User; member: HouseholdMember };

export const actorOf = (ctx: HouseholdCtx): Actor => ({ userId: ctx.user.id, role: ctx.member.role });

/** requireHousehold for API/actions: never redirects, throws Unauthorized/Forbidden. */
export function resolveHousehold(householdId: string): Promise<HouseholdCtx> {
  return requireHousehold(householdId, { throwOnMissing: true });
}

/**
 * For routes addressed by entity id (events/:id, todos/:id, posts/:id): finds the owning
 * household, then requireHousehold. Non-members get 404 (not 403) so ids don't leak.
 */
export async function resolveByEntity(
  id: string,
  what: string,
  findHouseholdId: (id: string) => Promise<string | null>,
): Promise<HouseholdCtx & { householdId: string }> {
  assertUuid(id, what);
  const householdId = await findHouseholdId(id);
  if (!householdId) throw new NotFoundError(`${what} not found`);
  try {
    const ctx = await resolveHousehold(householdId);
    return { ...ctx, householdId };
  } catch (err) {
    if (err instanceof ForbiddenError) throw new NotFoundError(`${what} not found`);
    throw err;
  }
}
