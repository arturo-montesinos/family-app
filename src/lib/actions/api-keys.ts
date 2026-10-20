"use server";

import type { ApiKeyInfo } from "@/lib/db/queries/api-keys";
import { resolveHousehold } from "@/lib/services/context";
import * as apiKeyService from "@/lib/services/api-keys";
import { apiKeyCreateSchema } from "@/lib/validators";
import { parse, resolveHouseholdFromInput, revalidate, ROUTES, run, type ActionResult } from "./_utils";

type ApiKeyInput = { householdId?: string; name: string; scopes: string[]; expiresAt?: string | Date | null };

/**
 * Creates an agent API key (owner only). The returned `key` is the full secret and is
 * shown exactly once; only its hash is stored.
 */
export async function createApiKey(input: ApiKeyInput | FormData): Promise<ActionResult<ApiKeyInfo & { key: string }>> {
  return run(async () => {
    const data = parse(apiKeyCreateSchema, input);
    const ctx = await resolveHouseholdFromInput(input);
    const row = await apiKeyService.createApiKey(ctx, data);
    revalidate(ROUTES.apiKeys, ROUTES.activity);
    return row;
  });
}

/** Revokes a key immediately (owner only). */
export async function revokeApiKey(householdId: string, keyId: string): Promise<ActionResult<ApiKeyInfo>> {
  return run(async () => {
    const ctx = await resolveHousehold(householdId);
    const row = await apiKeyService.revokeApiKey(ctx, keyId);
    revalidate(ROUTES.apiKeys, ROUTES.activity);
    return row;
  });
}
