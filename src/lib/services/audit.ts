import "server-only";
import { headers } from "next/headers";
import { insertAuditRow, listAudit, type AuditFilter } from "@/lib/db/queries/audit";
import { entityTypeOf, sanitizeMetadata, summarize, type AuditAction } from "@/lib/audit";
import { assertCan } from "@/lib/permissions";
import { actorOf, type HouseholdCtx } from "./context";

export type AuditDetails = {
  entityId?: string | null;
  /** Short human description: a title, a name. Never secrets. */
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Client IP from the proxy headers, when available (Vercel sets x-forwarded-for). */
async function requestIp(): Promise<string | null> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    return fwd || h.get("x-real-ip") || null;
  } catch {
    return null; // outside a request (scripts, tests)
  }
}

/**
 * Low-level audit write. Never throws: an audit failure is logged and the main action
 * continues (neon-http has no interactive transactions to enrol it in).
 */
export async function recordAudit(entry: {
  householdId: string;
  actorUserId: string | null;
  apiKeyId?: string | null;
  action: AuditAction;
  details?: AuditDetails;
}): Promise<void> {
  try {
    await insertAuditRow({
      householdId: entry.householdId,
      actorType: entry.apiKeyId ? "api_key" : "user",
      actorUserId: entry.actorUserId,
      apiKeyId: entry.apiKeyId ?? null,
      action: entry.action,
      entityType: entityTypeOf(entry.action),
      entityId: entry.details?.entityId ?? null,
      summary: summarize(entry.details?.summary),
      metadata: sanitizeMetadata(entry.details?.metadata),
      ip: await requestIp(),
    });
  } catch (err) {
    console.error(`[audit] failed to record ${entry.action}:`, err instanceof Error ? err.message : err);
  }
}

/** Audit a mutation made in a household context (web UI → user; API key → api_key). */
export function audit(ctx: HouseholdCtx, action: AuditAction, details?: AuditDetails): Promise<void> {
  return recordAudit({
    householdId: ctx.member.householdId,
    actorUserId: ctx.user.id,
    apiKeyId: ctx.via?.id ?? null,
    action,
    details,
  });
}

export const AUDIT_PAGE_SIZE = 50;

/** Activity view (owner only). `page` is 1-based. */
export async function listActivity(ctx: HouseholdCtx, filter: AuditFilter, page = 1) {
  assertCan(actorOf(ctx), "audit:view");
  const p = Math.max(1, Math.floor(page));
  const { rows, total } = await listAudit(ctx.member.householdId, filter, {
    limit: AUDIT_PAGE_SIZE,
    offset: (p - 1) * AUDIT_PAGE_SIZE,
  });
  return { rows, total, page: p, pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) };
}
