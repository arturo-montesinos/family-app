import "server-only";
import { requireHousehold } from "@/lib/auth-helpers";
import * as memberQueries from "@/lib/db/queries/members";
import type { HouseholdMember, User } from "@/lib/db/schema";
import { ForbiddenError, NotFoundError, assertUuid } from "@/lib/errors";
import type { ApiScope } from "@/lib/api-keys";
import type { Actor } from "@/lib/permissions";

/** The API key a request was made with (agents). Absent for the web UI / session calls. */
export type ApiKeyActor = { id: string; name: string; scopes: ApiScope[]; householdId: string };

/**
 * Resolved caller in a household: who they are and their membership row.
 * For API-key requests, `user`/`member` are the admin who owns the key and `via` is the key,
 * so permissions are the owner's and content/audit rows are attributed to the key.
 */
export type HouseholdCtx = { user: User; member: HouseholdMember; via?: ApiKeyActor };

/** Who is calling: a signed-in session, or an API key acting for its creator. */
export type Principal = { kind: "session"; user: User } | { kind: "api_key"; user: User; key: ApiKeyActor };

export const actorOf = (ctx: HouseholdCtx): Actor => ({ userId: ctx.user.id, role: ctx.member.role });

/** requireHousehold for API/actions: never redirects, throws Unauthorized/Forbidden. */
export function resolveHousehold(householdId: string): Promise<HouseholdCtx> {
  return requireHousehold(householdId, { throwOnMissing: true });
}

/**
 * Household context for a principal. API keys are bound to one household: any other id is
 * treated as not found. The key's creator must still be a member (else 403).
 */
export async function resolveHouseholdFor(principal: Principal, householdId: string): Promise<HouseholdCtx> {
  if (principal.kind === "session") return resolveHousehold(householdId);
  if (householdId !== principal.key.householdId) throw new NotFoundError("Household not found");
  const member = await memberQueries.getMember(householdId, principal.user.id);
  if (!member) throw new ForbiddenError("The owner of this API key is no longer a household member");
  return { user: principal.user, member, via: principal.key };
}

/**
 * For routes addressed by entity id (events/:id, todos/:id, posts/:id): finds the owning
 * household, then checks membership. Non-members get 404 (not 403) so ids don't leak.
 */
export async function resolveByEntity(
  id: string,
  what: string,
  findHouseholdId: (id: string) => Promise<string | null>,
  principal?: Principal,
): Promise<HouseholdCtx & { householdId: string }> {
  assertUuid(id, what);
  const householdId = await findHouseholdId(id);
  if (!householdId) throw new NotFoundError(`${what} not found`);
  try {
    const ctx = principal ? await resolveHouseholdFor(principal, householdId) : await resolveHousehold(householdId);
    return { ...ctx, householdId };
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) throw new NotFoundError(`${what} not found`);
    throw err;
  }
}
