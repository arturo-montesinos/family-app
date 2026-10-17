import { withApi } from "@/lib/api";
import * as householdService from "@/lib/services/households";
import { householdCreateSchema } from "@/lib/validators";

/** GET /api/v1/households — households the caller belongs to (with their role). */
export const GET = withApi({}, () => householdService.listMyHouseholds());

/** POST /api/v1/households — create a household; the caller becomes owner. */
export const POST = withApi({ body: householdCreateSchema, status: 201 }, ({ body }) =>
  householdService.createHousehold(body),
);
