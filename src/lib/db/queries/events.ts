import { and, asc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventAttendees, events, type Event, type NewEvent } from "@/lib/db/schema";
import { DAY_MS, expandEvents, type Occurrence } from "@/lib/recurrence";
import type { BatchList } from "./_batch";

export type EventWithAttendees = Event & { attendeeIds: string[] };
export type EventOccurrence = Occurrence<EventWithAttendees>;

type EventFields = Omit<
  NewEvent,
  "id" | "householdId" | "createdBy" | "createdViaApiKeyId" | "createdAt" | "updatedAt"
>;

/** Attaches attendee ids to a list of events (1 extra query). */
async function withAttendees(rows: Event[]): Promise<EventWithAttendees[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const links = await db
    .select()
    .from(eventAttendees)
    .where(inArray(eventAttendees.eventId, ids));
  const byEvent = new Map<string, string[]>();
  for (const l of links) {
    const arr = byEvent.get(l.eventId) ?? [];
    arr.push(l.userId);
    byEvent.set(l.eventId, arr);
  }
  return rows.map((r) => ({ ...r, attendeeIds: byEvent.get(r.id) ?? [] }));
}

export async function getEvent(householdId: string, eventId: string): Promise<EventWithAttendees | null> {
  const [row] = await db
    .select()
    .from(events)
    .where(and(eq(events.householdId, householdId), eq(events.id, eventId)))
    .limit(1);
  if (!row) return null;
  const [withA] = await withAttendees([row]);
  return withA;
}

/** Looks up an event by id alone (for /api/v1/events/:id) — callers must then requireHousehold. */
export async function findEventHouseholdId(eventId: string): Promise<string | null> {
  const [row] = await db
    .select({ householdId: events.householdId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  return row?.householdId ?? null;
}

/**
 * Occurrences overlapping [from, to), with recurring events expanded.
 *
 * SQL prefilter (cheap superset):
 *  - one-off events: starts_at < to AND coalesce(ends_at, starts_at + 1 day) >= from
 *  - recurring events: starts_at < to (their end is decided by the RRULE; COUNT/UNTIL
 *    are evaluated during expansion)
 * Exact overlap is then computed in `expandEvents`.
 */
export async function listEventsInRange(
  householdId: string,
  from: Date,
  to: Date,
  opts: { timeZone?: string } = {},
): Promise<EventOccurrence[]> {
  const fromMinusDay = new Date(from.getTime() - DAY_MS);
  const rows = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.householdId, householdId),
        lt(events.startsAt, to),
        or(
          isNotNull(events.rrule),
          and(
            isNull(events.rrule),
            sql`coalesce(${events.endsAt}, ${events.startsAt}) >= ${fromMinusDay.toISOString()}::timestamptz`,
          ),
        ),
      ),
    )
    .orderBy(asc(events.startsAt));

  return expandEvents(await withAttendees(rows), from, to, opts);
}

export async function createEvent(
  householdId: string,
  createdBy: string,
  fields: EventFields,
  attendeeIds: string[],
  createdViaApiKeyId: string | null = null,
): Promise<EventWithAttendees> {
  const id = crypto.randomUUID();
  const unique = [...new Set(attendeeIds)];
  const insertEvent = db
    .insert(events)
    .values({ ...fields, id, householdId, createdBy, createdViaApiKeyId })
    .returning();
  const ops: BatchList = [insertEvent];
  if (unique.length) {
    ops.push(db.insert(eventAttendees).values(unique.map((userId) => ({ eventId: id, userId }))));
  }
  const [[row]] = (await db.batch(ops)) as [Event[], ...unknown[]];
  return { ...row, attendeeIds: unique };
}

/**
 * Updates fields and (optionally) replaces the attendee set, atomically via db.batch.
 * Returns null when the event doesn't exist in this household.
 */
export async function updateEvent(
  householdId: string,
  eventId: string,
  patch: Partial<EventFields>,
  attendeeIds?: string[],
): Promise<EventWithAttendees | null> {
  const scope = and(eq(events.householdId, householdId), eq(events.id, eventId));
  const hasFields = Object.values(patch).some((v) => v !== undefined);

  if (attendeeIds === undefined) {
    if (!hasFields) return getEvent(householdId, eventId);
    const [row] = await db.update(events).set(patch).where(scope).returning();
    return row ? (await withAttendees([row]))[0] : null;
  }

  const unique = [...new Set(attendeeIds)];
  // Always touch the event row (updatedAt) so the batch returns it and proves scope.
  const ops: BatchList = [
    db
      .update(events)
      .set({ ...patch, updatedAt: new Date() })
      .where(scope)
      .returning(),
    // Scoped by household via subquery so a foreign eventId can't wipe someone else's attendees.
    db
      .delete(eventAttendees)
      .where(
        and(
          eq(eventAttendees.eventId, eventId),
          inArray(eventAttendees.eventId, db.select({ id: events.id }).from(events).where(scope)),
        ),
      ),
  ];
  if (unique.length) {
    const userArray = sql`array[${sql.join(
      unique.map((u) => sql`${u}`),
      sql`, `,
    )}]::text[]`;
    // insert … select from the scoped event: inserts nothing if the event isn't in this household.
    ops.push(
      db.execute(sql`
        insert into ${eventAttendees} (event_id, user_id)
        select ${events.id}, u.user_id
          from ${events}
         cross join unnest(${userArray}) as u(user_id)
         where ${events.householdId} = ${householdId} and ${events.id} = ${eventId}
        on conflict do nothing
      `),
    );
  }
  const [[row]] = (await db.batch(ops)) as [Event[], ...unknown[]];
  return row ? { ...row, attendeeIds: unique } : null;
}

export async function deleteEvent(householdId: string, eventId: string): Promise<boolean> {
  const rows = await db
    .delete(events)
    .where(and(eq(events.householdId, householdId), eq(events.id, eventId)))
    .returning({ id: events.id });
  return rows.length > 0;
}
