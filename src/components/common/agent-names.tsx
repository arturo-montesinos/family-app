"use client";

import { createContext, useContext } from "react";
import { BotIcon } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** API key id → key name for the active household (for "via <key>" attribution). */
const AgentNamesContext = createContext<Record<string, string>>({});

export function AgentNamesProvider({ names, children }: { names: Record<string, string>; children: React.ReactNode }) {
  return <AgentNamesContext.Provider value={names}>{children}</AgentNamesContext.Provider>;
}

export function useAgentName(keyId: string | null | undefined): string | null {
  const names = useContext(AgentNamesContext);
  if (!keyId) return null;
  return names[keyId] ?? t("agent.unknownKey");
}

/** "via Claude" — renders nothing for content made in the app. */
export function ViaAgent({ keyId, className }: { keyId: string | null | undefined; className?: string }) {
  const name = useAgentName(keyId);
  if (!name) return null;
  return <span className={cn("text-muted-foreground", className)}>{t("agent.via", { name })}</span>;
}

/** "Added via Claude" line for dialogs. */
export function AddedViaAgent({ keyId, className }: { keyId: string | null | undefined; className?: string }) {
  const name = useAgentName(keyId);
  if (!name) return null;
  return (
    <p className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <BotIcon className="size-3.5" aria-hidden />
      {t("agent.addedVia", { name })}
    </p>
  );
}
