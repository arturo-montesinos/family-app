/**
 * Audit log vocabulary + pure helpers. The DB write is in services/audit.ts.
 */

export const AUDIT_ACTIONS = [
  "event.create",
  "event.update",
  "event.delete",
  "todo.create",
  "todo.update",
  "todo.complete",
  "todo.reopen",
  "todo.delete",
  "post.create",
  "post.update",
  "post.pin",
  "post.unpin",
  "post.delete",
  "api_key.create",
  "api_key.revoke",
  "invite.create",
  "invite.revoke",
  "invite.accept",
  "member.update",
  "member.remove",
  "household.create",
  "household.update",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITY_TYPES = ["event", "todo", "post", "api_key", "invite", "member", "household"] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/** "event.create" → "event". */
export function entityTypeOf(action: AuditAction): AuditEntityType {
  return action.slice(0, action.indexOf(".")) as AuditEntityType;
}

export const SUMMARY_MAX = 140;

/** One line, trimmed, at most SUMMARY_MAX chars (with an ellipsis). */
export function summarize(text: string | null | undefined): string {
  const one = (text ?? "").replace(/\s+/g, " ").trim();
  return one.length > SUMMARY_MAX ? one.slice(0, SUMMARY_MAX - 1) + "…" : one;
}

/** Keys whose values must never reach the audit log. */
const SECRET_KEY_RE = /(key|token|secret|password|hash|authorization)/i;

/** Drops secret-looking keys and undefined values; null if nothing remains. */
export function sanitizeMetadata(meta: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!meta) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || SECRET_KEY_RE.test(k)) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** Names of the fields present in an update payload (for "changed: title, dueAt"). */
export function changedFields(input: Record<string, unknown>): string[] {
  return Object.entries(input)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => k);
}
