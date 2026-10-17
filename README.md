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
| `npm run build` | `db:migrate` then `next build` (migrations are skipped with a warning if `DATABASE_URL` is unset) |
| `npm run start` | Serve the production build |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm run db:generate` | Generate a new SQL migration from `src/lib/db/schema.ts` into `./drizzle` |
| `npm run db:migrate` | Apply pending migrations (`src/lib/db/migrate.ts`, neon-http migrator) |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Seed demo data (placeholder) |

Schema workflow: edit `src/lib/db/schema.ts` -> `npm run db:generate` -> commit the new file in `./drizzle` -> it is applied on the next deploy.

## Deploy (Vercel + Neon)

1. Push the repo to GitHub.
2. Vercel -> New Project -> import the repo (Next.js is auto-detected).
3. Vercel -> Storage -> Create Neon database -> connect it to the project (injects `DATABASE_URL`).
4. Add the remaining env vars from `.env.example` (`AUTH_SECRET`, `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`) and set `AUTH_TRUST_HOST=true`.
5. The build command is `npm run build` (= `npm run db:migrate && next build`), so migrations run on every deploy. Preview deploys use Neon branching via the integration.
