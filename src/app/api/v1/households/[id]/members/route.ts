import { withHouseholdApi } from "@/lib/api";
import * as householdService from "@/lib/services/households";

/** GET /api/v1/households/:id/members */
export const GET = withHouseholdApi({}, (ctx) => householdService.listMembers(ctx));
