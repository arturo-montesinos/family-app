/** API key scopes and statuses. Client-safe (no node:crypto), shared with lib/api-keys.ts. */
export const API_SCOPES = ["read", "write", "delete"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export type ApiKeyStatus = "active" | "revoked" | "expired";
