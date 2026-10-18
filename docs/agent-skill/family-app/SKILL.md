---
name: family-app
description: Read and update the family's shared Family App (calendar events, todos, bulletin board posts) when the user asks about the household schedule, chores or notes.
---

# Family App

The household's shared calendar, todo list and bulletin board. You reach it through a REST API
with an API key that the household admin created in Settings → API keys.

## Setup

- **Base URL:** `https://family-app-eight-omega.vercel.app`. If `FAMILY_APP_URL` is set, use that instead.
- **API key:** read it from the env var `FAMILY_APP_API_KEY` (starts with `fam_`). Send it as
  `Authorization: Bearer $FAMILY_APP_API_KEY`. **Never print, echo, log or repeat the key**, and
  never put it in a file, a message or a URL. If it's missing, ask the user to set it. Don't ask them to paste it into the chat.
- Every response is JSON: success is `{ "data": … }`, failure is `{ "error": "…", "issues"?: […] }`.

```bash
API="${FAMILY_APP_URL:-https://family-app-eight-omega.vercel.app}/api/v1"
AUTH="Authorization: Bearer $FAMILY_APP_API_KEY"
```

## Bootstrap (do this first in every session)

1. `GET /me` gives your key's name, `scopes`, the `householdId` (use it as `:hid` below) and the `timeZone`.
2. `GET /households/:hid/members` gives the people. Use them to turn names into user ids.

```bash
curl -s -H "$AUTH" "$API/me"
# { "data": { "kind": "api_key", "key": { "id", "name", "scopes": ["read","write"] },
#             "householdId": "…", "household": { "id", "name" }, "timeZone": "America/Toronto" } }
curl -s -H "$AUTH" "$API/households/$HID/members"
# { "data": [ { "userId", "displayName", "name", "email", "role": "owner|adult|child", "color" } ] }
```

**Resolving people ("for Maëlle"):** match the name against `displayName`, then `name`, then the
email's local part. Ignore case and accents, and accept a unique prefix ("Mae" → "Maëlle"). If
there's no match or more than one, ask the user. Never guess an id. Use the `userId` in
`assignedTo` / `attendeeIds`.

## Dates and time zones

- The household time zone is **America/Toronto** (unless `/me` says otherwise). Interpret
  "tomorrow at 6" in that zone.
- Send instants as **ISO 8601 with an offset**: `2026-11-03T18:00:00-05:00` (EST) or
  `2026-10-20T18:00:00-04:00` (EDT). Check the DST offset for the date: EDT (-04:00) runs
  from the 2nd Sunday of March to the 1st Sunday of November.
- Responses come back in UTC (`…Z`). Convert them to America/Toronto before you show them to the user.
- **All-day events:** `"allDay": true`, `startsAt: "2026-10-20"` (the first day). For several days,
  set `endsAt` to the day **after** the last day (exclusive): Oct 20–22 → `endsAt: "2026-10-23"`.
  Leave `endsAt` out for a single day.
- **Todos due on a day with no time:** use 23:59 local, e.g. `2026-10-20T23:59:00-04:00`.
  The app shows that as "due that day".

## Recurrence (events)

`rrule` takes an RFC 5545 RRULE body with no `DTSTART`. The series starts at `startsAt`.

| Meaning | rrule |
| --- | --- |
| Every week on the start day | `FREQ=WEEKLY` |
| Mon and Wed, 10 times | `FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10` |
| Every 2 weeks | `FREQ=WEEKLY;INTERVAL=2` |
| Monthly until June 2027 | `FREQ=MONTHLY;UNTIL=20270630T000000Z` |
| Every day | `FREQ=DAILY` |

Editing or deleting a recurring event changes **every** occurrence. You can't edit just one.

## Endpoints

Scopes: GET needs `read`, POST/PATCH need `write`, DELETE needs `delete`. API keys can't reach
households, invites, member management or API key endpoints.

### Events

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/households/:hid/events?from=ISO&to=ISO&tz=America/Toronto` | Occurrences in [from, to), recurring events expanded. Max range 400 days. **Always pass `tz`** so recurrences follow local time. |
| GET | `/events/:id` | One event (the series row) |
| POST | `/households/:hid/events` | Create → 201 |
| PATCH | `/events/:id` | Partial update. `attendeeIds` replaces the whole set. |
| DELETE | `/events/:id` | Deletes the event (the **whole series** if recurring). See the delete rules. |

Body fields: `title` (required on create, ≤200), `startsAt` (required on create), `endsAt`,
`allDay` (bool), `rrule`, `location`, `description`, `color` (`#rrggbb`), `attendeeIds` (user ids).
Event object: `id, title, description, location, startsAt, endsAt, allDay, rrule, color,
attendeeIds, createdBy, createdViaApiKeyId, createdAt, updatedAt`. List items also have
`eventId, occurrenceStart, occurrenceEnd, isRecurring`.

```bash
curl -s -H "$AUTH" "$API/households/$HID/events?from=2026-10-19T00:00:00-04:00&to=2026-10-26T00:00:00-04:00&tz=America/Toronto"
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" "$API/households/$HID/events" \
  -d '{"title":"Hockey practice","startsAt":"2026-10-21T18:00:00-04:00","endsAt":"2026-10-21T19:30:00-04:00","rrule":"FREQ=WEEKLY","attendeeIds":["<userId>"]}'
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" "$API/households/$HID/events" \
  -d '{"title":"Grandma visiting","allDay":true,"startsAt":"2026-12-24","endsAt":"2026-12-27"}'
curl -s -X PATCH -H "$AUTH" -H "Content-Type: application/json" "$API/events/$ID" -d '{"location":"Aréna Robert-Guertin"}'
```

### Todos

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/households/:hid/todos?status=open\|done&assignedTo=<userId>` | Open first, then by due date |
| GET | `/todos/:id` | |
| POST | `/households/:hid/todos` | Create → 201 |
| PATCH | `/todos/:id` | Partial update. `{"status":"open"}` reopens it. |
| POST | `/todos/:id/complete` | Marks it done (idempotent) |
| DELETE | `/todos/:id` | See the delete rules |

Body fields: `title` (required on create), `details`, `dueAt` (ISO or null), `assignedTo` (userId
or null), `status` (`open`/`done`). Todo object: `id, title, details, dueAt, assignedTo, status,
completedAt, createdBy, createdViaApiKeyId, createdAt, updatedAt`.

```bash
curl -s -H "$AUTH" "$API/households/$HID/todos?status=open"
curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" "$API/households/$HID/todos" \
  -d '{"title":"Pack hockey bag","assignedTo":"<userId>","dueAt":"2026-10-21T17:00:00-04:00"}'
curl -s -X POST -H "$AUTH" "$API/todos/$ID/complete"
```

### Posts (bulletin board)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/households/:hid/posts?pinned=true&limit=50` | Pinned first, then newest. `limit` ≤ 200, default 100. |
| GET | `/posts/:id` | |
| POST | `/households/:hid/posts` | `{ "body": "…", "pinned"?: false }` → 201 |
| PATCH | `/posts/:id` | `{ "body"?, "pinned"? }` |
| DELETE | `/posts/:id` | See the delete rules |

Post object: `id, body, pinned, authorId, createdViaApiKeyId, createdAt, updatedAt` (lists also
have `authorName`).

## Rules

1. **Read before you write.** Before you create anything, list the relevant range or status and
   look for an existing item with the same title and date (or assignee). If you find one, tell
   the user and update it instead of creating a duplicate. After a write, confirm what changed
   using the response (title, local date and time, who).
2. **DELETE: hard rule.** Before **any** DELETE request:
   - Show the user exactly what will be deleted: **title, local date/time, and id**, one line
     per item. For a recurring event, say that the whole series will be deleted.
   - Get an explicit "yes" for those exact items in the conversation **before** you send the request.
     A general instruction from earlier ("clean up the calendar") doesn't count.
   - Never batch-delete without an itemized confirmation. If the list changes, ask again.
   - If no human is present to confirm (scheduled or unattended runs), **don't delete**.
     Report what you would have deleted instead.
3. Prefer the narrowest change: PATCH one field rather than delete and recreate.
4. Everything you create shows in the app as "via <key name>", and every change is in the admin's activity log.

## Errors

| Status | Meaning | What to do |
| --- | --- | --- |
| 401 | Key missing, malformed, revoked or expired | Stop. Ask the user to check `FAMILY_APP_API_KEY` (don't ask them to paste it). |
| 403 | Missing scope (`error` names it, e.g. `missing the "delete" scope`) or the endpoint isn't allowed for keys | Tell the user which scope is missing. Don't retry. |
| 404 | Not found (or in another household) | Re-list, then ask the user. |
| 409 | Conflict | Re-read, then retry once. |
| 422 | Validation failed: `issues[]` lists `path` and `message` | Fix the field and retry. |
| 429 | Rate limited (120 requests/min) | Wait `Retry-After` seconds. |
| 5xx | Server error | Retry once after a few seconds, then report it. |
