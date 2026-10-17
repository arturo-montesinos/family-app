import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { requireHousehold, requireUser } from "@/lib/auth-helpers";
import { listHouseholdsForUser, type HouseholdWithRole } from "@/lib/db/queries/households";
import type { HouseholdMember, User } from "@/lib/db/schema";
import { isUuid } from "@/lib/errors";

/** Cookie holding the active household id for the web UI. */
export const ACTIVE_HOUSEHOLD_COOKIE = "fa_household";

export const ACTIVE_HOUSEHOLD_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/** Households of the signed-in user (cached per request). Redirects to /signin if signed out. */
export const getMyHouseholds = cache(async (): Promise<HouseholdWithRole[]> => {
  const user = await requireUser();
  return listHouseholdsForUser(user.id);
});

/**
 * Active household id: the `fa_household` cookie if the user is still a member of it,
 * else the user's first household, else null (→ onboarding). Redirects to /signin when
 * signed out. Read-only (Server Components can't set cookies); use the
 * `setActiveHousehold` action to persist a choice.
 */
export const getActiveHouseholdId = cache(async (): Promise<string | null> => {
  const households = await getMyHouseholds();
  if (households.length === 0) return null;
  const store = await cookies();
  const fromCookie = store.get(ACTIVE_HOUSEHOLD_COOKIE)?.value;
  if (fromCookie && isUuid(fromCookie) && households.some((h) => h.id === fromCookie)) {
    return fromCookie;
  }
  return households[0].id;
});

/** Active household + its row for the switcher, or null. */
export const getActiveHousehold = cache(async (): Promise<HouseholdWithRole | null> => {
  const id = await getActiveHouseholdId();
  if (!id) return null;
  return (await getMyHouseholds()).find((h) => h.id === id) ?? null;
});

/**
 * Pages / actions: requires a signed-in user with an active household.
 * - signed out → redirect("/signin")
 * - no household → redirect("/onboarding") (override with `onMissing`), or pass
 *   `{ onMissing: "null" }` to get null instead.
 * - otherwise → { householdId, user, member } (member.role = owner|adult|child)
 */
export async function requireActiveHousehold(): Promise<ActiveHouseholdCtx>;
export async function requireActiveHousehold(opts: { onMissing: "null" }): Promise<ActiveHouseholdCtx | null>;
export async function requireActiveHousehold(opts: { onMissing?: string }): Promise<ActiveHouseholdCtx>;
export async function requireActiveHousehold(
  opts: { onMissing?: string } = {},
): Promise<ActiveHouseholdCtx | null> {
  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    if (opts.onMissing === "null") return null;
    return redirect(opts.onMissing ?? "/onboarding");
  }
  const { user, member } = await requireHousehold(householdId);
  return { householdId, user, member };
}

export type ActiveHouseholdCtx = { householdId: string; user: User; member: HouseholdMember };
