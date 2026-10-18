import { withHouseholdApi } from "@/lib/api";
import * as householdService from "@/lib/services/households";

/** GET /api/v1/households/:id/members (read-only for API keys: lets agents resolve names to ids). */
export const GET = withHouseholdApi({ allowApiKeys: true }, (ctx) => householdService.listMembers(ctx));
