import { withEntityApi } from "@/lib/api";
import { findEventHouseholdId } from "@/lib/db/queries/events";
import * as eventService from "@/lib/services/events";
import { eventUpdateSchema } from "@/lib/validators";

const entity = { entity: "Event", findHouseholdId: findEventHouseholdId };

/** GET /api/v1/events/:id (convenience; not in PLAN.md but harmless and useful for mobile). */
export const GET = withEntityApi(entity, (ctx) => eventService.getEvent(ctx, ctx.id));

/** PATCH /api/v1/events/:id */
export const PATCH = withEntityApi({ ...entity, body: eventUpdateSchema }, (ctx) =>
  eventService.updateEvent(ctx, ctx.id, ctx.body),
);

/** DELETE /api/v1/events/:id */
export const DELETE = withEntityApi(entity, (ctx) => eventService.deleteEvent(ctx, ctx.id));
