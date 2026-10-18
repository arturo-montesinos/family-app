# Family App

Shared household planner: calendar, todos and bulletin board.
Next.js 15 (App Router) + Neon Postgres + Drizzle ORM + Auth.js v5 (email magic links via Resend) + Tailwind/shadcn/ui.

Production: https://family-app-eight-omega.vercel.app

See `PLAN.md` (architecture) for the full design.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, AUTH_SECRET, AUTH_RESEND_KEY, AUTH_EMAIL_FROM
npm run db:migrate           # apply SQL migrations in ./drizzle to the database
npm run dev                  # http://localhost:3000
```

Generate `AUTH_SECRET` with `openssl rand -base64 32`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | `skill:generate`, `db:migrate`, then `next build` (migrations are skipped with a warning if `DATABASE_URL` is unset) |
| `npm run start` | Serve the production build |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm run db:generate` | Generate a new SQL migration from `src/lib/db/schema.ts` into `./drizzle` |
| `npm run db:migrate` | Apply pending migrations (`src/lib/db/migrate.ts`, neon-http migrator) |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Seed demo data (placeholder) |
| `npm run skill:generate` | Re-embed `docs/agent-skill/family-app/SKILL.md` into the app (also runs in `build`) |

Schema workflow: edit `src/lib/db/schema.ts` -> `npm run db:generate` -> commit the new file in `./drizzle` -> it is applied on the next deploy.

## Deploy (Vercel + Neon)

1. Push the repo to GitHub.
2. Vercel -> New Project -> import the repo (Next.js is auto-detected).
3. Vercel -> Storage -> Create Neon database -> connect it to the project (injects `DATABASE_URL`).
4. Add the remaining env vars from `.env.example` (`AUTH_SECRET`, `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`) and set `AUTH_TRUST_HOST=true`.
5. The build command is `npm run build` (= `npm run db:migrate && next build`), so migrations run on every deploy. Preview deploys use Neon branching via the integration.

## API keys for AI agents

The admin (the household owner) can create API keys so an AI agent (for example Claude with
the Family App skill) can read and write events, todos and bulletin posts through `/api/v1`.

**Create a key:** Settings → API keys → name it (e.g. "Claude"), pick scopes, optionally set an
expiry → **Create key**. The full key (`fam_…`) is shown **once**. Copy it and store it where the
agent runs as `FAMILY_APP_API_KEY`. Only a SHA-256 hash and an 8-character prefix are stored.
Revoke a key from the same page; it stops working immediately.

| Scope | Allows |
| --- | --- |
| `read` (always on) | `GET` events, todos, posts, members, `/me`, `/skill` |
| `write` | `POST`/`PATCH`: create, update, complete |
| `delete` | `DELETE` events, todos, posts |

Keys act as the admin who created them, only within that household. They can **never** reach
households, invites, member management or API key endpoints (403 whatever the scopes). Missing
scope → 403 naming it. Revoked or expired → 401. Rate limit: 120 requests/min per key (429 +
`Retry-After`). The limiter is in memory and per serverless instance, so it is a safety net, not
a hard guarantee. Content created through a key shows "via <key name>" in the app, and every
change (from the app or a key) appears in Settings → Activity.

**Agent endpoints:** `GET /api/v1/me` (bootstrap), `GET /api/v1/households/:id/members`,
events (`GET/POST /households/:id/events`, `GET/PATCH/DELETE /events/:id`), todos
(`GET/POST /households/:id/todos`, `GET/PATCH/DELETE /todos/:id`, `POST /todos/:id/complete`),
posts (`GET/POST /households/:id/posts`, `GET/PATCH/DELETE /posts/:id`), `GET /api/v1/skill`.
The skill documents the full shapes.

### Install the agent skill

The skill lives in `docs/agent-skill/family-app/SKILL.md` (single source of truth; the build
embeds it into the app). Get it from Settings → API keys → **Agent skill** (copy, **Download
SKILL.md** or **Download .zip**), or `GET /api/v1/skill?download=1` with an owner session or any
key. The served copy uses `NEXT_PUBLIC_APP_URL` (or the request origin) as the base URL and
never contains a key.

- **Claude Code:** put it at `~/.claude/skills/family-app/SKILL.md` (or `.claude/skills/…` in a
  project) and `export FAMILY_APP_API_KEY=fam_…` in the shell that runs Claude.
- **Claude apps:** upload the `.zip` as a skill (Settings → Capabilities → Skills) and provide
  the key as `FAMILY_APP_API_KEY` in the environment where the skill runs.

The skill makes the agent confirm every delete item by item with a human, and never delete
when nobody is there to confirm.

After editing `SKILL.md`, run `npm run skill:generate` and commit the regenerated
`src/lib/agent-skill/content.generated.ts`. A test fails if they drift.
