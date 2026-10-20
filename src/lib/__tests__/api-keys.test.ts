import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  API_KEY_PREFIX,
  RateLimiter,
  apiKeyAccessError,
  apiKeyPrefix,
  apiKeyStatus,
  bearerToken,
  generateApiKey,
  hashApiKey,
  isWellFormedApiKey,
  missingScopeMessage,
  normalizeScopes,
  requiredScope,
  shouldTouchLastUsed,
} from "@/lib/api-keys";
import { apiKeyCreateSchema, parseActorFilter } from "@/lib/validators";

describe("key generation and hashing", () => {
  it("generates fam_ + 43 base64url chars (32 bytes)", () => {
    const { key } = generateApiKey();
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(key).toMatch(/^fam_[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(key.slice(4), "base64url")).toHaveLength(32);
    expect(isWellFormedApiKey(key)).toBe(true);
  });

  it("returns the prefix (8 chars after fam_) and the SHA-256 hex of the full key", () => {
    const { key, prefix, hash } = generateApiKey();
    expect(prefix).toBe(key.slice(4, 12));
    expect(apiKeyPrefix(key)).toBe(prefix);
    expect(hash).toBe(createHash("sha256").update(key).digest("hex"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(key)).toBe(hash);
  });

  it("is unique per call", () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey().key));
    expect(keys.size).toBe(50);
  });

  it("rejects malformed keys", () => {
    expect(isWellFormedApiKey("fam_short")).toBe(false);
    expect(isWellFormedApiKey("sk_" + "a".repeat(43))).toBe(false);
    expect(isWellFormedApiKey("fam_" + "a".repeat(42) + "!")).toBe(false);
  });
});

describe("bearerToken", () => {
  it("extracts the token", () => {
    expect(bearerToken("Bearer fam_abc")).toBe("fam_abc");
    expect(bearerToken("bearer   fam_abc  ")).toBe("fam_abc");
  });
  it("returns null without a Bearer header (session fallback)", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken("Basic dXNlcjpwYXNz")).toBeNull();
  });
});

describe("scope resolution per method", () => {
  it.each([
    ["GET", "read"],
    ["HEAD", "read"],
    ["POST", "write"],
    ["PATCH", "write"],
    ["PUT", "write"],
    ["DELETE", "delete"],
    ["delete", "delete"],
  ] as const)("%s needs %s", (method, scope) => {
    expect(requiredScope(method)).toBe(scope);
  });

  it("allows an opted-in route when the scope is present", () => {
    expect(apiKeyAccessError({ allowApiKeys: true, method: "GET", scopes: ["read"] })).toBeNull();
    expect(apiKeyAccessError({ allowApiKeys: true, method: "POST", scopes: ["read", "write"] })).toBeNull();
    expect(apiKeyAccessError({ allowApiKeys: true, method: "DELETE", scopes: ["read", "delete"] })).toBeNull();
  });

  it("names the missing scope", () => {
    expect(apiKeyAccessError({ allowApiKeys: true, method: "PATCH", scopes: ["read"] })).toBe(
      missingScopeMessage("write"),
    );
    expect(apiKeyAccessError({ allowApiKeys: true, method: "DELETE", scopes: ["read", "write"] })).toMatch(
      /"delete" scope/,
    );
  });

  it("forbids routes that didn't opt in (admin endpoints), whatever the scopes", () => {
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      expect(
        apiKeyAccessError({ allowApiKeys: undefined, method, scopes: ["read", "write", "delete"] }),
      ).toBe("API keys can't access this endpoint");
    }
  });

  it("normalizes scopes: known only, read always, canonical order", () => {
    expect(normalizeScopes(["delete", "bogus", "write"])).toEqual(["read", "write", "delete"]);
    expect(normalizeScopes([])).toEqual(["read"]);
  });
});

describe("key status and last_used throttling", () => {
  const now = new Date("2026-10-18T12:00:00Z");
  it("computes status", () => {
    expect(apiKeyStatus({ revokedAt: null, expiresAt: null }, now)).toBe("active");
    expect(apiKeyStatus({ revokedAt: null, expiresAt: new Date("2026-10-19") }, now)).toBe("active");
    expect(apiKeyStatus({ revokedAt: null, expiresAt: new Date("2026-10-18T11:59:59Z") }, now)).toBe("expired");
    expect(apiKeyStatus({ revokedAt: new Date("2026-10-01"), expiresAt: null }, now)).toBe("revoked");
  });
  it("touches last_used_at at most once a minute", () => {
    expect(shouldTouchLastUsed(null, now)).toBe(true);
    expect(shouldTouchLastUsed(new Date(now.getTime() - 30_000), now)).toBe(false);
    expect(shouldTouchLastUsed(new Date(now.getTime() - 60_000), now)).toBe(true);
  });
});

describe("RateLimiter", () => {
  it("allows `limit` hits per window, then reports retryAfter, then resets", () => {
    const rl = new RateLimiter(3, 60_000);
    const t0 = 1_000_000;
    expect(rl.hit("k", t0).ok).toBe(true);
    expect(rl.hit("k", t0 + 1).ok).toBe(true);
    expect(rl.hit("k", t0 + 2).ok).toBe(true);
    const blocked = rl.hit("k", t0 + 10_000);
    expect(blocked).toEqual({ ok: false, retryAfter: 50 });
    expect(rl.hit("other", t0 + 10_000).ok).toBe(true);
    expect(rl.hit("k", t0 + 60_000).ok).toBe(true);
  });
});

describe("apiKeyCreateSchema", () => {
  it("requires read and orders scopes", () => {
    expect(apiKeyCreateSchema.parse({ name: " Claude ", scopes: ["write", "read"] })).toMatchObject({
      name: "Claude",
      scopes: ["read", "write"],
    });
    expect(apiKeyCreateSchema.safeParse({ name: "x", scopes: ["write"] }).success).toBe(false);
    expect(apiKeyCreateSchema.safeParse({ name: "x", scopes: ["admin"] }).success).toBe(false);
    expect(apiKeyCreateSchema.safeParse({ name: "", scopes: ["read"] }).success).toBe(false);
  });
  it("accepts a single form value and rejects past expiry", () => {
    expect(apiKeyCreateSchema.parse({ name: "x", scopes: "read" }).scopes).toEqual(["read"]);
    expect(apiKeyCreateSchema.safeParse({ name: "x", scopes: ["read"], expiresAt: "2000-01-01" }).success).toBe(false);
    expect(apiKeyCreateSchema.parse({ name: "x", scopes: ["read"], expiresAt: "" }).expiresAt).toBeNull();
  });
});

describe("parseActorFilter", () => {
  it("parses user and key filters", () => {
    expect(parseActorFilter("user:abc")).toEqual({ actorUserId: "abc" });
    expect(parseActorFilter("key:8b0f7e0c-3c56-4c8e-9d6f-1a2b3c4d5e6f")).toEqual({
      apiKeyId: "8b0f7e0c-3c56-4c8e-9d6f-1a2b3c4d5e6f",
    });
    expect(parseActorFilter("key:not-a-uuid")).toEqual({});
    expect(parseActorFilter(undefined)).toEqual({});
  });
});
