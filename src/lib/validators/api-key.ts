import { z } from "zod";
import { API_SCOPES } from "@/lib/api-scopes";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit";
import { nullableDate, userId, uuid } from "./common";

export const apiScopeSchema = z.enum(API_SCOPES);

/** Scopes from a form (repeated checkbox values) or JSON array. `read` is mandatory. */
const scopes = z
  .preprocess((v) => (typeof v === "string" ? [v] : v), z.array(apiScopeSchema).min(1, "Pick at least one scope"))
  .refine((s) => s.includes("read"), { message: "The read scope is required" })
  .transform((s) => API_SCOPES.filter((x) => s.includes(x)));

export const apiKeyCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(60),
    scopes,
    /** Optional expiry; must be in the future. */
    expiresAt: nullableDate,
  })
  .refine((o) => !o.expiresAt || o.expiresAt.getTime() > Date.now(), {
    message: "Expiry must be in the future",
    path: ["expiresAt"],
  });

/** Activity filters: `?actor=user:<id>|key:<uuid>&entity=event&page=2`. */
export const auditQuerySchema = z.object({
  actor: z
    .union([z.templateLiteral(["user:", z.string()]), z.templateLiteral(["key:", z.string()])])
    .optional()
    .catch(undefined),
  entity: z.enum(AUDIT_ENTITY_TYPES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

/** Parses the `actor` filter value into a query filter. Invalid ids are dropped. */
export function parseActorFilter(actor: string | undefined): { actorUserId?: string; apiKeyId?: string } {
  if (!actor) return {};
  if (actor.startsWith("user:")) {
    const r = userId.safeParse(actor.slice(5));
    return r.success ? { actorUserId: r.data } : {};
  }
  if (actor.startsWith("key:")) {
    const r = uuid.safeParse(actor.slice(4));
    return r.success ? { apiKeyId: r.data } : {};
  }
  return {};
}

export type ApiKeyCreateInput = z.output<typeof apiKeyCreateSchema>;
export type AuditQuery = z.output<typeof auditQuerySchema>;
