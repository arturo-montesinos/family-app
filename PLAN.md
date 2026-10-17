# Family App — Architecture & Build Plan (v1)

A shared household planner: calendar, todos, bulletin board. Web first (Vercel), mobile client later reusing the same API.

## Stack
- **Framework:** Next.js 15 (App Router, TypeScript, `src/` dir), deployed on Vercel
- **DB:** Postgres on Neon (via Vercel Marketplace integration), accessed with `@neondatabase/serverless`
- **ORM:** Drizzle ORM + `drizzle-kit` for migrations
- **Auth:** Auth.js v5 (`next-auth@beta`), email magic links (Resend provider), Drizzle adapter
- **UI:** Tailwind CSS + shadcn/ui, lucide icons, `date-fns` for dates, `rrule` for recurrence
- **Validation:** Zod schemas shared by server actions and `/api/v1` routes

## Project layout
```
src/
  app/
    (auth)/signin/            magic-link sign-in
    (app)/                    authenticated shell (sidebar/nav, household switcher)
      dashboard/              today: events, due todos, pinned posts
      calendar/               month + week views
      todos/
      board/                  bulletin board
      settings/household/     members, invites, colors
    api/auth/[...nextauth]/
    api/v1/                   REST for future mobile: households, events, todos, posts, invites
    invite/[token]/           accept invite
  lib/
    db/
      index.ts                neon + drizzle client
      schema.ts               all tables (below)
    auth.ts                   Auth.js config + helpers (auth(), requireHousehold())
    validators/               zod schemas per entity
    actions/                  server actions per entity (events, todos, posts, households, invites)
    api.ts                    shared handler wrapper for /api/v1 (auth, zod, errors)
  components/
    ui/                       shadcn
    calendar/, todos/, board/, household/
drizzle/                      generated SQL migrations
```

## Schema (Drizzle, Postgres)
All domain tables carry `household_id`; every query is scoped by it.

- `users` (Auth.js) — id, name, email, email_verified, image
- `accounts`, `sessions`, `verification_tokens` (Auth.js adapter tables)
- `households` — id (uuid), name, created_at
- `household_members` — household_id, user_id, role enum(owner|adult|child), color (hex), display_name, joined_at; PK (household_id, user_id)
- `invites` — id, household_id, email, token (unique), role, invited_by, expires_at, accepted_at
- `events` — id, household_id, title, description, location, starts_at (timestamptz), ends_at, all_day bool, rrule text null, color null, created_by, created_at, updated_at
- `event_attendees` — event_id, user_id; PK both
- `todos` — id, household_id, title, details, due_at null, assigned_to null, status enum(open|done), completed_at, created_by, created_at, updated_at
- `posts` — id, household_id, author_id, body, pinned bool default false, created_at, updated_at

Indexes: (household_id, starts_at) on events; (household_id, status, due_at) on todos; (household_id, pinned, created_at) on posts.

## Auth & authorization
- Magic link via Resend. First sign-in with no household → onboarding: create household or paste invite.
- `requireHousehold(householdId)` helper: loads session, asserts membership, returns member row (role). Owners manage members/invites; adults create/edit anything; children can create/complete their own todos and post, but not delete others' content.
- Mobile later: same Auth.js session cookie, or `/api/v1` bearer token once needed.

## Access model (decided 2026-10-17)
- Single household, invite-only. `ADMIN_EMAIL` names the administrator, the only person who can create the household (once) and the sole owner. Nobody can be promoted to owner and invites can't grant owner.
- Sign-in gate (Auth.js `signIn` callback): only the admin, existing members, or addresses with a pending invite can sign in; everyone else gets "invite-only" and no email is sent.
- Invites: 32-byte random token, single-use, 7-day expiry, bound to the invited email, revocable.
- Login methods: email magic link (Resend) and Google sign-in (`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`). Family members use Google until a domain is verified in Resend.
- `/api/health` reports config, DB/migration state and access counts (no addresses or secrets).

## API
- Web UI uses Server Actions (`lib/actions/*`), each validating with Zod and calling `requireHousehold`.
- `/api/v1/*` route handlers wrap the same `lib/db` queries for the future mobile client:
  - `GET/POST /api/v1/households`, `GET /api/v1/households/:id/members`
  - `GET/POST /api/v1/households/:id/events?from&to`, `PATCH/DELETE /api/v1/events/:id`
  - `GET/POST /api/v1/households/:id/todos`, `PATCH/DELETE /api/v1/todos/:id`
  - `GET/POST /api/v1/households/:id/posts`, `PATCH/DELETE /api/v1/posts/:id`
  - `POST /api/v1/invites`, `POST /api/v1/invites/:token/accept`

## Environment
```
DATABASE_URL=            # Neon pooled connection string
AUTH_SECRET=             # openssl rand -base64 32
AUTH_RESEND_KEY=         # Resend API key
AUTH_EMAIL_FROM=         # e.g. "Family App <login@yourdomain>"
NEXT_PUBLIC_APP_URL=
```

## Deployment flow
1. Push repo to GitHub.
2. Vercel → New Project → import repo (Next.js auto-detected).
3. Vercel → Storage → Create Neon database → connect to project (injects `DATABASE_URL`).
4. Add remaining env vars in Vercel. Set `AUTH_TRUST_HOST=true`.
5. Build command: `npm run db:migrate && next build` (migrations run on deploy). Preview deploys use Neon branching via the integration.

## Build order (subagents)
1. **Scaffold + DB + auth plumbing** — create-next-app, Tailwind/shadcn, Drizzle schema + first migration, neon client, Auth.js config, env example, scripts.
2. **Backend** — Zod validators, server actions, `/api/v1` handlers, authorization helper, seed script.
3. **UI** — app shell, onboarding/invite, dashboard, calendar (month/week, recurrence), todos, board, household settings.
4. **Polish** — PWA manifest, loading/empty states, README, Vercel config.

## Later
- Realtime updates (Pusher or polling with SWR revalidation)
- Push notifications / reminders
- Expo mobile client consuming `/api/v1`
