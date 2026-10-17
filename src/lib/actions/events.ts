"use server";

import * as eventQueries from "@/lib/db/queries/events";
import type { EventOccurrence, EventWithAttendees } from "@/lib/db/queries/events";
import { resolveByEntity } from "@/lib/services/context";
import * as eventService from "@/lib/services/events";
import { eventCreateSchema, eventRangeSchema, eventUpdateSchema } from "@/lib/validators";
import { formToObject, parse, resolveHouseholdFromInput, revalidate, ROUTES, run, type ActionResult } from "./_utils";

type EventInput = {
  householdId?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string | Date;
  endsAt?: string | Date | null;
  allDay?: boolean;
  rrule?: string | null;
  color?: string | null;
  attendeeIds?: string[];
};

const revalidateEvents = () => revalidate(ROUTES.calendar, ROUTES.dashboard);

/** Creates an event in `input.householdId` (default: active household). */
export async function createEvent(input: EventInput | FormData): Promise<ActionResult<EventWithAttendees>> {
  return run(async () => {
    const data = parse(eventCreateSchema, input);
    const ctx = await resolveHouseholdFromInput(input);
    const row = await eventService.createEvent(ctx, data);
    revalidateEvents();
    return row;
  });
}

/** Partial update. `attendeeIds`, when given, replaces the whole attendee set. */
export async function updateEvent(
  eventId: string,
  input: Partial<Omit<EventInput, "householdId">> | FormData,
): Promise<ActionResult<EventWithAttendees>> {
  return run(async () => {
    const data = parse(eventUpdateSchema, input);
    const ctx = await resolveByEntity(eventId, "Event", eventQueries.findEventHouseholdId);
    const row = await eventService.updateEvent(ctx, eventId, data);
    revalidateEvents();
    return row;
  });
}

/** Deletes the event (all occurrences of a recurring series). */
export async function deleteEvent(eventId: string): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await resolveByEntity(eventId, "Event", eventQueries.findEventHouseholdId);
    const result = await eventService.deleteEvent(ctx, eventId);
    revalidateEvents();
    return result;
  });
}

/** Read helper for client components (e.g. week navigation without a full page reload). */
export async function listEvents(input: {
  householdId?: string;
  from: string | Date;
  to: string | Date;
  tz?: string;
}): Promise<ActionResult<EventOccurrence[]>> {
  return run(async () => {
    const range = eventRangeSchema.parse(formToObject(input));
    const ctx = await resolveHouseholdFromInput(input);
    return eventService.listEventsInRange(ctx, range);
  });
}
