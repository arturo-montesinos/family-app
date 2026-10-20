import "server-only";
import * as eventQueries from "@/lib/db/queries/events";
import * as memberQueries from "@/lib/db/queries/members";
import { BadRequestError, NotFoundError, assertUuid } from "@/lib/errors";
import { assertCan } from "@/lib/permissions";
import { normalizeAllDayRange } from "@/lib/recurrence";
import type { EventCreateInput, EventRangeInput, EventUpdateInput } from "@/lib/validators";
import { changedFields } from "@/lib/audit";
import { audit } from "./audit";
import { actorOf, type HouseholdCtx } from "./context";

async function validAttendees(householdId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const members = await memberQueries.filterMemberIds(householdId, unique);
  if (members.length !== unique.length) throw new BadRequestError("Attendees must be household members");
  return unique;
}

export function listEventsInRange(ctx: HouseholdCtx, range: EventRangeInput) {
  return eventQueries.listEventsInRange(ctx.member.householdId, range.from, range.to, {
    timeZone: range.tz,
  });
}

export async function getEvent(ctx: HouseholdCtx, eventId: string) {
  assertUuid(eventId, "Event");
  const row = await eventQueries.getEvent(ctx.member.householdId, eventId);
  if (!row) throw new NotFoundError("Event not found");
  return row;
}

export async function createEvent(ctx: HouseholdCtx, input: EventCreateInput) {
  assertCan(actorOf(ctx), "content:create");
  const householdId = ctx.member.householdId;
  const attendeeIds = await validAttendees(householdId, input.attendeeIds);
  const range = input.allDay
    ? normalizeAllDayRange(input.startsAt, input.endsAt)
    : { startsAt: input.startsAt, endsAt: input.endsAt ?? null };
  const row = await eventQueries.createEvent(
    householdId,
    ctx.user.id,
    {
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      allDay: input.allDay,
      rrule: input.rrule ?? null,
      color: input.color ?? null,
      ...range,
    },
    attendeeIds,
    ctx.via?.id ?? null,
  );
  await audit(ctx, "event.create", {
    entityId: row.id,
    summary: row.title,
    metadata: { startsAt: row.startsAt.toISOString(), allDay: row.allDay, rrule: row.rrule },
  });
  return row;
}

export async function updateEvent(ctx: HouseholdCtx, eventId: string, input: EventUpdateInput) {
  const householdId = ctx.member.householdId;
  const existing = await getEvent(ctx, eventId);
  assertCan(actorOf(ctx), "content:update", existing);

  const attendeeIds =
    input.attendeeIds === undefined ? undefined : await validAttendees(householdId, input.attendeeIds);

  // Merge with the stored row to validate / normalize the final time range.
  const allDay = input.allDay ?? existing.allDay;
  let startsAt = input.startsAt ?? existing.startsAt;
  let endsAt = input.endsAt === undefined ? existing.endsAt : input.endsAt;
  if (allDay) ({ startsAt, endsAt } = normalizeAllDayRange(startsAt, endsAt));
  if (endsAt && endsAt.getTime() < startsAt.getTime()) throw new BadRequestError("End must be after start");
  const timeTouched =
    input.allDay !== undefined || input.startsAt !== undefined || input.endsAt !== undefined;

  const row = await eventQueries.updateEvent(
    householdId,
    eventId,
    {
      title: input.title,
      description: input.description,
      location: input.location,
      rrule: input.rrule,
      color: input.color,
      ...(timeTouched ? { allDay, startsAt, endsAt } : {}),
    },
    attendeeIds,
  );
  if (!row) throw new NotFoundError("Event not found");
  await audit(ctx, "event.update", {
    entityId: row.id,
    summary: row.title,
    metadata: { changed: changedFields(input) },
  });
  return row;
}

export async function deleteEvent(ctx: HouseholdCtx, eventId: string) {
  const existing = await getEvent(ctx, eventId);
  assertCan(actorOf(ctx), "content:delete", existing);
  await eventQueries.deleteEvent(ctx.member.householdId, eventId);
  await audit(ctx, "event.delete", {
    entityId: eventId,
    summary: existing.title,
    metadata: { startsAt: existing.startsAt.toISOString(), rrule: existing.rrule },
  });
  return { id: eventId };
}
