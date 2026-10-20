import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, type ApiKey } from "@/lib/db/schema";

/** Public shape: everything except the hash. */
export type ApiKeyInfo = Omit<ApiKey, "keyHash">;

const infoColumns = {
  id: apiKeys.id,
  householdId: apiKeys.householdId,
  name: apiKeys.name,
  prefix: apiKeys.prefix,
  scopes: apiKeys.scopes,
  createdBy: apiKeys.createdBy,
  createdAt: apiKeys.createdAt,
  expiresAt: apiKeys.expiresAt,
  lastUsedAt: apiKeys.lastUsedAt,
  revokedAt: apiKeys.revokedAt,
};

/** Hash lookup is necessarily global (the key is the capability). */
export async function findApiKeyByHash(keyHash: string): Promise<ApiKeyInfo | null> {
  const [row] = await db.select(infoColumns).from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
  return row ?? null;
}

export async function listApiKeys(householdId: string): Promise<ApiKeyInfo[]> {
  return db
    .select(infoColumns)
    .from(apiKeys)
    .where(eq(apiKeys.householdId, householdId))
    .orderBy(desc(apiKeys.createdAt));
}

/** id → name for every key in the household (for "via <key>" labels). */
export async function apiKeyNames(householdId: string): Promise<Record<string, string>> {
  const rows = await db
    .select({ id: apiKeys.id, name: apiKeys.name })
    .from(apiKeys)
    .where(eq(apiKeys.householdId, householdId));
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

export async function createApiKey(input: {
  householdId: string;
  name: string;
  prefix: string;
  keyHash: string;
  scopes: string[];
  createdBy: string;
  expiresAt: Date | null;
}): Promise<ApiKeyInfo> {
  const [row] = await db.insert(apiKeys).values(input).returning(infoColumns);
  return row;
}

/** Sets revoked_at if not already revoked. Returns the row, or null if not found / already revoked. */
export async function revokeApiKey(householdId: string, keyId: string): Promise<ApiKeyInfo | null> {
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.householdId, householdId), eq(apiKeys.id, keyId), isNull(apiKeys.revokedAt)))
    .returning(infoColumns);
  return row ?? null;
}

export async function touchApiKeyLastUsed(keyId: string, at: Date = new Date()): Promise<void> {
  await db.update(apiKeys).set({ lastUsedAt: at }).where(eq(apiKeys.id, keyId));
}
