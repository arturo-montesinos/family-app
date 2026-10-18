import { withApi } from "@/lib/api";
import { getHousehold } from "@/lib/db/queries/households";
import { DEFAULT_TZ } from "@/lib/dates";
import { listMyHouseholds } from "@/lib/services/households";

/**
 * GET /api/v1/me — bootstrap for clients and agents.
 * API key → the key's name, scopes, household (id, name) and time zone.
 * Session → the user and their households.
 * The household time zone is America/Toronto until per-household zones exist.
 */
export const GET = withApi({ allowApiKeys: true }, async ({ principal }) => {
  if (principal.kind === "api_key") {
    const household = await getHousehold(principal.key.householdId);
    return {
      kind: "api_key" as const,
      key: { id: principal.key.id, name: principal.key.name, scopes: principal.key.scopes },
      actingAs: { userId: principal.user.id, name: principal.user.name },
      household: { id: principal.key.householdId, name: household?.name ?? null },
      householdId: principal.key.householdId,
      timeZone: DEFAULT_TZ,
    };
  }
  const households = await listMyHouseholds();
  return {
    kind: "session" as const,
    user: { id: principal.user.id, name: principal.user.name, email: principal.user.email },
    households: households.map((h) => ({ id: h.id, name: h.name, role: h.role })),
    householdId: households[0]?.id ?? null,
    timeZone: DEFAULT_TZ,
  };
});
