import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as apiKeyQueries from "@/lib/db/queries/api-keys";
import { users } from "@/lib/db/schema";
import {
  API_KEY_RATE_LIMIT,
  RateLimiter,
  apiKeyStatus,
  generateApiKey,
  hashApiKey,
  isWellFormedApiKey,
  normalizeScopes,
  shouldTouchLastUsed,
} from "@/lib/api-keys";
import { NotFoundError, TooManyRequestsError, UnauthorizedError, assertUuid } from "@/lib/errors";
import { assertCan } from "@/lib/permissions";
import type { ApiKeyCreateInput } from "@/lib/validators";
import { audit } from "./audit";
import { actorOf, type HouseholdCtx, type Principal } from "./context";

/* ------------------------------ admin (owner) ------------------------------ */

export async function listApiKeys(ctx: HouseholdCtx) {
  assertCan(actorOf(ctx), "api_key:manage");
  return apiKeyQueries.listApiKeys(ctx.member.householdId);
}

/**
 * Creates a key and returns it with the full secret — the ONLY time it is available.
 * Keys can't create keys (the API wrapper blocks the route), but guard anyway.
 */
export async function createApiKey(ctx: HouseholdCtx, input: ApiKeyCreateInput) {
  assertCan(actorOf(ctx), "api_key:manage");
  if (ctx.via) throw new NotFoundError();
  const { key, prefix, hash } = generateApiKey();
  const row = await apiKeyQueries.createApiKey({
    householdId: ctx.member.householdId,
    name: input.name,
    prefix,
    keyHash: hash,
    scopes: normalizeScopes(input.scopes),
    createdBy: ctx.user.id,
    expiresAt: input.expiresAt ?? null,
  });
  await audit(ctx, "api_key.create", {
    entityId: row.id,
    summary: `${row.name} (fam_${row.prefix}…)`,
    metadata: { scopes: row.scopes, expiresAt: row.expiresAt?.toISOString() ?? null },
  });
  return { ...row, key };
}

export async function revokeApiKey(ctx: HouseholdCtx, keyId: string) {
  assertCan(actorOf(ctx), "api_key:manage");
  if (ctx.via) throw new NotFoundError();
  assertUuid(keyId, "API key");
  const row = await apiKeyQueries.revokeApiKey(ctx.member.householdId, keyId);
  if (!row) throw new NotFoundError("API key not found or already revoked");
  await audit(ctx, "api_key.revoke", { entityId: row.id, summary: `${row.name} (fam_${row.prefix}…)` });
  return row;
}

/* ------------------------------ authentication ----------------------------- */

const limiter = new RateLimiter(API_KEY_RATE_LIMIT.limit, API_KEY_RATE_LIMIT.windowMs);

/**
 * Bearer key → principal acting as the key's creator. 401 for unknown, malformed,
 * revoked or expired keys (same message, so keys can't be probed); 429 over the rate limit.
 * Never logs the key.
 */
export async function authenticateApiKey(token: string): Promise<Principal> {
  const invalid = () => new UnauthorizedError("Invalid, revoked or expired API key");
  if (!isWellFormedApiKey(token)) throw invalid();
  const row = await apiKeyQueries.findApiKeyByHash(hashApiKey(token));
  if (!row || !row.createdBy || apiKeyStatus(row) !== "active") throw invalid();

  const rl = limiter.hit(row.id);
  if (!rl.ok) throw new TooManyRequestsError("Rate limit exceeded for this API key", rl.retryAfter);

  const [user] = await db.select().from(users).where(eq(users.id, row.createdBy)).limit(1);
  if (!user) throw invalid();

  if (shouldTouchLastUsed(row.lastUsedAt)) {
    // Fire-and-forget: a failed timestamp update must not fail the request.
    apiKeyQueries.touchApiKeyLastUsed(row.id).catch((err) => {
      console.error("[api-keys] last_used_at update failed:", err instanceof Error ? err.message : err);
    });
  }

  return {
    kind: "api_key",
    user,
    key: { id: row.id, name: row.name, scopes: normalizeScopes(row.scopes), householdId: row.householdId },
  };
}
