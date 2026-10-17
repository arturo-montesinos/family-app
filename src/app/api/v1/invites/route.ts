import { withApi } from "@/lib/api";
import { resolveHousehold } from "@/lib/services/context";
import * as inviteService from "@/lib/services/invites";
import { inviteCreateSchema } from "@/lib/validators";

/** POST /api/v1/invites — body `{ householdId, email, role? }` (owner only). Returns the invite + url. */
export const POST = withApi({ body: inviteCreateSchema, status: 201 }, async ({ body }) => {
  const ctx = await resolveHousehold(body.householdId);
  return inviteService.createInvite(ctx, body);
});
