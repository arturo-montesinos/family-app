import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, auditLog, householdMembers, users, type NewAuditLogRow } from "@/lib/db/schema";

export async function insertAuditRow(row: NewAuditLogRow): Promise<void> {
  await db.insert(auditLog).values(row);
}

export type AuditFilter = {
  /** Only rows by this user acting in person (actor_type=user). */
  actorUserId?: string;
  /** Only rows made with this API key. */
  apiKeyId?: string;
  entityType?: string;
};

export type AuditEntry = {
  id: string;
  occurredAt: Date;
  actorType: "user" | "api_key";
  actorUserId: string | null;
  actorName: string | null;
  actorDisplayName: string | null;
  apiKeyId: string | null;
  apiKeyName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
};

function where(householdId: string, f: AuditFilter): SQL | undefined {
  const conds: SQL[] = [eq(auditLog.householdId, householdId)];
  if (f.actorUserId) conds.push(eq(auditLog.actorType, "user"), eq(auditLog.actorUserId, f.actorUserId));
  if (f.apiKeyId) conds.push(eq(auditLog.apiKeyId, f.apiKeyId));
  if (f.entityType) conds.push(eq(auditLog.entityType, f.entityType));
  return and(...conds);
}

/** Newest first, with actor + key names. */
export async function listAudit(
  householdId: string,
  filter: AuditFilter,
  page: { limit: number; offset: number },
): Promise<{ rows: AuditEntry[]; total: number }> {
  const cond = where(householdId, filter);
  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: auditLog.id,
        occurredAt: auditLog.occurredAt,
        actorType: auditLog.actorType,
        actorUserId: auditLog.actorUserId,
        actorName: users.name,
        actorDisplayName: householdMembers.displayName,
        apiKeyId: auditLog.apiKeyId,
        apiKeyName: apiKeys.name,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        summary: auditLog.summary,
        metadata: auditLog.metadata,
        ip: auditLog.ip,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorUserId))
      .leftJoin(
        householdMembers,
        and(eq(householdMembers.householdId, auditLog.householdId), eq(householdMembers.userId, auditLog.actorUserId)),
      )
      .leftJoin(apiKeys, eq(apiKeys.id, auditLog.apiKeyId))
      .where(cond)
      .orderBy(desc(auditLog.occurredAt), desc(auditLog.id))
      .limit(page.limit)
      .offset(page.offset),
    db.select({ n: count() }).from(auditLog).where(cond),
  ]);
  return { rows: rows as AuditEntry[], total: totalRow?.n ?? 0 };
}
