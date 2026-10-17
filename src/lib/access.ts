import { and, count, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { householdMembers, households, invites, users } from "@/lib/db/schema";

/**
 * Single-household, invite-only access control.
 *
 *  - ADMIN_EMAIL (comma-separated allowed) names the administrator(s). Only an admin can
 *    create the household, and only while none exists.
 *  - A magic-link email is only sent to: an admin, an existing household member, or an
 *    address with a pending, unexpired invite. Everyone else is refused before any email
 *    goes out (Auth.js shows "AccessDenied").
 *  - Nobody can be promoted to owner and invites can't grant owner: the admin is the
 *    single owner and the only person who controls access.
 */

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

const lower = (col: typeof users.email | typeof invites.email) => sql`lower(${col})`;

async function isMemberEmail(email: string): Promise<boolean> {
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .innerJoin(householdMembers, eq(householdMembers.userId, users.id))
    .where(eq(lower(users.email), email));
  return (row?.n ?? 0) > 0;
}

async function hasPendingInvite(email: string): Promise<boolean> {
  const [row] = await db
    .select({ n: count() })
    .from(invites)
    .where(and(eq(lower(invites.email), email), isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())));
  return (row?.n ?? 0) > 0;
}

/** May this address receive a sign-in link / complete sign-in? */
export async function isEmailAllowedToSignIn(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (isAdminEmail(e)) return true;
  if (await isMemberEmail(e)) return true;
  return hasPendingInvite(e);
}

export async function countHouseholds(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(households);
  return row?.n ?? 0;
}

/** Diagnostics for /api/health — counts and booleans only, no addresses. */
export async function accessSummary() {
  const admins = adminEmails();
  const [h] = await db.select({ n: count() }).from(households);
  const [u] = await db.select({ n: count() }).from(users);
  const [m] = await db.select({ n: count() }).from(householdMembers);
  let adminHasAccount = false;
  let adminIsOwner = false;
  if (admins.length) {
    const rows = await db
      .select({ email: users.email, role: householdMembers.role })
      .from(users)
      .leftJoin(householdMembers, eq(householdMembers.userId, users.id))
      .where(inArray(sql`lower(${users.email})`, admins));
    adminHasAccount = rows.length > 0;
    adminIsOwner = rows.some((r) => r.role === "owner");
  }
  return {
    adminEmailConfigured: admins.length > 0,
    adminHasAccount,
    adminIsOwner,
    households: h?.n ?? 0,
    users: u?.n ?? 0,
    members: m?.n ?? 0,
  };
}
