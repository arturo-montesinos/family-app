import { withApi } from "@/lib/api";
import * as inviteService from "@/lib/services/invites";
import { inviteTokenSchema } from "@/lib/validators";

/** POST /api/v1/invites/:token/accept — joins the household (caller's email must match). */
export const POST = withApi({}, ({ params }) =>
  inviteService.acceptInvite(inviteTokenSchema.parse(params.token)),
);
