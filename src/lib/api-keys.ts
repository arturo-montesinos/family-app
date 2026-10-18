import { createHash, randomBytes } from "node:crypto";
import { API_SCOPES, type ApiKeyStatus, type ApiScope } from "./api-scopes";

/**
 * Agent API keys: format, hashing, scopes and rate limiting. Pure (no DB, no server-only)
 * so it can be unit-tested; the DB side lives in db/queries/api-keys.ts and
 * services/api-keys.ts.
 *
 * Key format: `fam_` + 32 random bytes base64url (43 chars). Only the SHA-256 hex of the
 * full key is stored, plus a short visible `prefix` (first 8 chars after `fam_`).
 * Lookups are by hash, so no constant-time comparison is needed. Never log a key.
 */

export const API_KEY_PREFIX = "fam_";
const KEY_RE = /^fam_[A-Za-z0-9_-]{43}$/;

export { API_SCOPES, type ApiKeyStatus, type ApiScope } from "./api-scopes";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** Visible id shown in the UI: the first 8 chars after `fam_`. */
export function apiKeyPrefix(key: string): string {
  return key.slice(API_KEY_PREFIX.length, API_KEY_PREFIX.length + 8);
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = API_KEY_PREFIX + randomBytes(32).toString("base64url");
  return { key, prefix: apiKeyPrefix(key), hash: hashApiKey(key) };
}

export function isWellFormedApiKey(value: string): boolean {
  return KEY_RE.test(value);
}

/**
 * Extracts a `fam_` bearer token from an Authorization header.
 * Returns null when there is no Bearer header at all (→ fall back to the session cookie),
 * or the raw token (possibly malformed — the caller rejects it with 401).
 */
export function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header.trim());
  return m ? m[1] : null;
}

/* --------------------------------- scopes ---------------------------------- */

/** HTTP method → required scope. GET/HEAD read; POST/PUT/PATCH write; DELETE delete. */
export function requiredScope(method: string): ApiScope {
  switch (method.toUpperCase()) {
    case "GET":
    case "HEAD":
    case "OPTIONS":
      return "read";
    case "DELETE":
      return "delete";
    default:
      return "write";
  }
}

export function missingScopeMessage(scope: ApiScope): string {
  return `This API key is missing the "${scope}" scope`;
}

/** Normalizes a scope list: known scopes only, deduplicated, canonical order, read always included. */
export function normalizeScopes(scopes: readonly string[]): ApiScope[] {
  const set = new Set(scopes.filter((s): s is ApiScope => (API_SCOPES as readonly string[]).includes(s)));
  set.add("read");
  return API_SCOPES.filter((s) => set.has(s));
}

/* ------------------------------- key status --------------------------------- */

export function apiKeyStatus(
  key: { revokedAt: Date | null; expiresAt: Date | null },
  now: Date = new Date(),
): ApiKeyStatus {
  if (key.revokedAt) return "revoked";
  if (key.expiresAt && key.expiresAt.getTime() <= now.getTime()) return "expired";
  return "active";
}

/** last_used_at is written at most once per this interval per key. */
export const LAST_USED_THROTTLE_MS = 60_000;

export function shouldTouchLastUsed(lastUsedAt: Date | null, now: Date = new Date()): boolean {
  return !lastUsedAt || now.getTime() - lastUsedAt.getTime() >= LAST_USED_THROTTLE_MS;
}

/* ------------------------------- rate limit --------------------------------- */

/**
 * Fixed-window in-memory rate limiter, per key id.
 *
 * LIMITATION: state lives in the memory of one serverless instance. On Vercel each warm
 * instance keeps its own counters and cold starts reset them, so the effective limit is
 * "per instance". Good enough to stop a runaway agent loop; not a security boundary.
 */
export class RateLimiter {
  private hits = new Map<string, { windowStart: number; count: number }>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
  ) {}

  /** Records a hit. Returns ok=false (and seconds to wait) once `limit` is exceeded. */
  hit(id: string, now: number = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
    const cur = this.hits.get(id);
    if (!cur || now - cur.windowStart >= this.windowMs) {
      this.hits.set(id, { windowStart: now, count: 1 });
      if (this.hits.size > 1000) this.prune(now);
      return { ok: true };
    }
    cur.count++;
    if (cur.count > this.limit) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((cur.windowStart + this.windowMs - now) / 1000)) };
    }
    return { ok: true };
  }

  private prune(now: number) {
    for (const [k, v] of this.hits) if (now - v.windowStart >= this.windowMs) this.hits.delete(k);
  }
}

/** 120 requests per minute per key. */
export const API_KEY_RATE_LIMIT = { limit: 120, windowMs: 60_000 };

/* ----------------------------- route access -------------------------------- */

/**
 * Pure access decision for an API-key request. Routes must opt in with
 * `allowApiKeys: true`; everything else (households, invites, member management,
 * API keys, activity) is 403 for keys regardless of scope.
 * Returns null when allowed, else the 403 message.
 */
export function apiKeyAccessError(opts: {
  allowApiKeys: boolean | undefined;
  method: string;
  scopes: readonly ApiScope[];
}): string | null {
  if (!opts.allowApiKeys) return "API keys can't access this endpoint";
  const scope = requiredScope(opts.method);
  if (!opts.scopes.includes(scope)) return missingScopeMessage(scope);
  return null;
}
