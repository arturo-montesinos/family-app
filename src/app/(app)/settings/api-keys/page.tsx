import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { renderSkill } from "@/lib/agent-skill";
import { apiKeyStatus } from "@/lib/api-keys";
import { getPageContext } from "@/lib/page-context";
import { canManageApiKeys } from "@/lib/permissions";
import { listApiKeys } from "@/lib/services/api-keys";
import { ApiKeysSettings } from "@/components/settings/api-keys-settings";

export const metadata = { title: "API keys" };

/** Owner only: everyone else gets a 404, like other admin-only resources. */
export default async function ApiKeysPage() {
  const ctx = await getPageContext();
  if (!canManageApiKeys(ctx.actor)) notFound();
  const keys = await listApiKeys(ctx);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : null;

  return (
    <ApiKeysSettings
      householdId={ctx.householdId}
      keys={keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        scopes: k.scopes,
        createdAt: k.createdAt.toISOString(),
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        expiresAt: k.expiresAt?.toISOString() ?? null,
        status: apiKeyStatus(k),
      }))}
      skill={renderSkill(origin)}
    />
  );
}
