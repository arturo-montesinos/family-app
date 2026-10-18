import { withHouseholdApi } from "@/lib/api";
import * as eventService from "@/lib/services/events";
import { eventCreateSchema, eventRangeSchema } from "@/lib/validators";

/** GET /api/v1/households/:id/events?from=ISO&to=ISO[&tz=IANA] — occurrences, recurring expanded. */
export const GET = withHouseholdApi({ query: eventRangeSchema, allowApiKeys: true }, (ctx) =>
  eventService.listEventsInRange(ctx, ctx.query),
);

/** POST /api/v1/households/:id/events */
export const POST = withHouseholdApi({ body: eventCreateSchema, status: 201, allowApiKeys: true }, (ctx) =>
  eventService.createEvent(ctx, ctx.body),
);
