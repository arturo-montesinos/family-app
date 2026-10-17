import { neon } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "@/lib/db/url";
import { accessSummary } from "@/lib/access";

/**
 * Public deployment diagnostics. Reports only whether config is present (never values,
 * except the sender domain), plus database reachability and migration state.
 * Open /api/health after a deploy to see what's missing.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXPECTED_TABLES = [
  "users",
  "accounts",
  "sessions",
  "verification_tokens",
  "households",
  "household_members",
  "invites",
  "events",
  "event_attendees",
  "todos",
  "posts",
];

export async function GET() {
  const db = resolveDatabaseUrl();
  const from = process.env.AUTH_EMAIL_FROM ?? "";
  const senderDomain = from.match(/@([^>\s]+)/)?.[1] ?? null;

  const env = {
    database: db ? `set (via ${db.source})` : "MISSING",
    AUTH_SECRET: process.env.AUTH_SECRET ? "set" : "MISSING",
    AUTH_RESEND_KEY: process.env.AUTH_RESEND_KEY
      ? process.env.AUTH_RESEND_KEY.startsWith("re_")
        ? "set"
        : "set (but does not start with re_ — check it)"
      : "MISSING",
    AUTH_EMAIL_FROM: from ? `set (sender domain: ${senderDomain ?? "unparseable"})` : "MISSING",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ? "set" : "not set (optional)",
    vercelEnv: process.env.VERCEL_ENV ?? "local",
  };

  const database: Record<string, unknown> = { reachable: false };
  if (db) {
    try {
      const sql = neon(db.url);
      const rows = (await sql`
        select table_name from information_schema.tables
        where table_schema = 'public'
      `) as { table_name: string }[];
      const present = new Set(rows.map((r) => r.table_name));
      database.reachable = true;
      database.missingTables = EXPECTED_TABLES.filter((t) => !present.has(t));
      database.migrated = (database.missingTables as string[]).length === 0;
    } catch (err) {
      database.error = err instanceof Error ? err.message : String(err);
    }
  }

  let access: Awaited<ReturnType<typeof accessSummary>> | { error: string } | null = null;
  if (database.reachable) {
    try {
      access = await accessSummary();
    } catch (err) {
      access = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  const notes: string[] = [];
  if (!process.env.ADMIN_EMAIL) {
    notes.push("ADMIN_EMAIL is not set: nobody can set up the household and only existing members/invitees can sign in.");
  }
  if (senderDomain === "resend.dev") {
    notes.push(
      "Using onboarding@resend.dev: Resend only delivers to the email address that owns the Resend account. Verify a domain in Resend to email anyone else.",
    );
  }

  const ok =
    !!db &&
    database.migrated === true &&
    env.AUTH_SECRET === "set" &&
    env.AUTH_RESEND_KEY === "set" &&
    !!from;

  // Always 200 so simple fetchers can read the body; check `ok` instead.
  return Response.json({ ok, env, database, access, notes });
}
