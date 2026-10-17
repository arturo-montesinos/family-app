import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

/**
 * Demo seed: household "Famille Demo" with an owner, an adult and a child, a few events
 * (one weekly recurring, one all-day), todos and posts.
 *
 * Idempotent: users are upserted by email; if a household named "Famille Demo" already
 * has the demo owner as a member, nothing else is written.
 * Sign in with any of the demo emails via magic link to explore (needs Resend configured).
 */
const HOUSEHOLD_NAME = "Famille Demo";

const DEMO_USERS = [
  { key: "owner", email: "camille.demo@example.com", name: "Camille", role: "owner", color: "#3b82f6" },
  { key: "adult", email: "julien.demo@example.com", name: "Julien", role: "adult", color: "#10b981" },
  { key: "child", email: "lea.demo@example.com", name: "Léa", role: "child", color: "#f59e0b" },
] as const;

const DAY = 24 * 60 * 60 * 1000;

function atUtc(base: Date, dayOffset: number, hours: number, minutes = 0): Date {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + dayOffset));
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}

/** Next given weekday (0=Sun..6=Sat) on or after today, at UTC midnight. */
function nextWeekday(from: Date, weekday: number): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + ((weekday - d.getUTCDay() + 7) % 7));
  return d;
}

async function main() {
  const url = (await import("./url")).getDatabaseUrl();
  if (!url) {
    console.warn("[db:seed] DATABASE_URL is not set — nothing to seed.");
    return;
  }

  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { and, eq } = await import("drizzle-orm");
  const s = await import("./schema");

  const db = drizzle({ client: neon(url), schema: s });

  // 1) Users (upsert by email so re-runs reuse the same ids).
  const ids = {} as Record<(typeof DEMO_USERS)[number]["key"], string>;
  for (const u of DEMO_USERS) {
    const [row] = await db
      .insert(s.users)
      .values({ email: u.email, name: u.name, emailVerified: new Date() })
      .onConflictDoUpdate({ target: s.users.email, set: { name: u.name } })
      .returning({ id: s.users.id });
    ids[u.key] = row.id;
  }

  // 2) Skip if the demo household already exists for the demo owner.
  const [existing] = await db
    .select({ id: s.households.id })
    .from(s.households)
    .innerJoin(s.householdMembers, eq(s.householdMembers.householdId, s.households.id))
    .where(and(eq(s.households.name, HOUSEHOLD_NAME), eq(s.householdMembers.userId, ids.owner)))
    .limit(1);
  if (existing) {
    console.log(`[db:seed] "${HOUSEHOLD_NAME}" already exists (${existing.id}) — skipping.`);
    return;
  }

  const householdId = crypto.randomUUID();
  const now = new Date();
  const soccer = crypto.randomUUID();
  const dentist = crypto.randomUUID();
  const dinner = crypto.randomUUID();
  const pedDay = crypto.randomUUID();
  const firstSaturday = nextWeekday(now, 6);

  // 3) Everything else in one atomic batch (neon-http has no interactive transactions).
  await db.batch([
    db.insert(s.households).values({ id: householdId, name: HOUSEHOLD_NAME }),
    db.insert(s.householdMembers).values(
      DEMO_USERS.map((u) => ({
        householdId,
        userId: ids[u.key],
        role: u.role,
        color: u.color,
        displayName: u.name,
      })),
    ),
    db.insert(s.events).values([
      {
        id: soccer,
        householdId,
        title: "Soccer practice (Léa)",
        location: "Parc de la Gatineau field 2",
        // Saturdays 14:00–15:30 UTC, weekly, 12 occurrences
        startsAt: atUtc(firstSaturday, 0, 14),
        endsAt: atUtc(firstSaturday, 0, 15, 30),
        rrule: "FREQ=WEEKLY;BYDAY=SA;COUNT=12",
        color: "#f59e0b",
        createdBy: ids.owner,
      },
      {
        id: dentist,
        householdId,
        title: "Dentist — Julien",
        startsAt: atUtc(now, 3, 15),
        endsAt: atUtc(now, 3, 16),
        createdBy: ids.adult,
      },
      {
        id: dinner,
        householdId,
        title: "Family dinner at grandma's",
        description: "Bring dessert",
        startsAt: atUtc(now, 5, 22),
        endsAt: atUtc(now, 6, 1),
        createdBy: ids.owner,
      },
      {
        id: pedDay,
        householdId,
        title: "Pedagogical day (no school)",
        startsAt: atUtc(now, 8, 0),
        endsAt: atUtc(now, 9, 0),
        allDay: true,
        createdBy: ids.owner,
      },
    ]),
    db.insert(s.eventAttendees).values([
      { eventId: soccer, userId: ids.child },
      { eventId: soccer, userId: ids.owner },
      { eventId: dentist, userId: ids.adult },
      ...DEMO_USERS.map((u) => ({ eventId: dinner, userId: ids[u.key] })),
    ]),
    db.insert(s.todos).values([
      {
        householdId,
        title: "Buy groceries",
        details: "Milk, eggs, apples, bread",
        dueAt: new Date(now.getTime() + DAY),
        assignedTo: ids.adult,
        createdBy: ids.owner,
      },
      {
        householdId,
        title: "Clean your room",
        dueAt: new Date(now.getTime() + 2 * DAY),
        assignedTo: ids.child,
        createdBy: ids.owner,
      },
      {
        householdId,
        title: "Sign school permission slip",
        assignedTo: ids.owner,
        createdBy: ids.child,
      },
      {
        householdId,
        title: "Book summer camp",
        status: "done",
        completedAt: new Date(now.getTime() - DAY),
        createdBy: ids.adult,
      },
    ]),
    db.insert(s.posts).values([
      {
        householdId,
        authorId: ids.owner,
        body: "Welcome to our family board! Wi-Fi password is on the fridge.",
        pinned: true,
      },
      { householdId, authorId: ids.adult, body: "I'll pick up the kids on Thursday." },
      { householdId, authorId: ids.child, body: "Can we get pizza on Friday? 🍕" },
    ]),
  ]);

  console.log(`[db:seed] Created "${HOUSEHOLD_NAME}" (${householdId}) with demo users:`);
  for (const u of DEMO_USERS) console.log(`  - ${u.name} <${u.email}> (${u.role})`);
}

main().catch((err) => {
  console.error("[db:seed] Failed:", err);
  process.exit(1);
});
