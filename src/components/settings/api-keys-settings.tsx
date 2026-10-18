"use client";

import { useActionState, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { CheckIcon, CopyIcon, DownloadIcon, KeyRoundIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CopyField } from "@/components/common/copy-field";
import { FieldError } from "@/components/common/field-error";
import { PageHeader } from "@/components/common/page-header";
import { SubmitButton } from "@/components/common/submit-button";
import { createApiKey, revokeApiKey } from "@/lib/actions/api-keys";
import type { ActionResult } from "@/lib/actions/types";
import { fieldError, toastResult } from "@/lib/action-client";
import { SKILL_DIR, SKILL_FILENAME } from "@/lib/agent-skill/constants";
import { API_SCOPES, type ApiKeyStatus, type ApiScope } from "@/lib/api-scopes";
import { DEFAULT_TZ, todayKey, zonedInstant } from "@/lib/dates";
import { dateLocale, t, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { zipFiles } from "@/lib/zip";

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  status: ApiKeyStatus;
};

const ago = (iso: string) =>
  formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: dateLocale });

export function ApiKeysSettings({ householdId, keys, skill }: { householdId: string; keys: ApiKeyRow[]; skill: string }) {
  return (
    <div className="max-w-3xl">
      <PageHeader title={t("apiKeys.title")} />
      <p className="-mt-2 mb-8 text-sm text-muted-foreground">{t("apiKeys.lead")}</p>

      <Section title={t("apiKeys.create")}>
        <CreateKeyForm householdId={householdId} />
      </Section>

      <Section title={t("apiKeys.list")}>
        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("apiKeys.none")}</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {keys.map((k) => (
              <KeyRow key={k.id} householdId={householdId} apiKey={k} />
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("skill.title")} lead={t("skill.lead")}>
        <SkillPanel skill={skill} />
      </Section>
    </div>
  );
}

function Section({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      {lead ? <p className="mt-1 text-sm text-muted-foreground">{lead}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* --------------------------------- create ---------------------------------- */

function CreateKeyForm({ householdId }: { householdId: string }) {
  const [scopes, setScopes] = useState<Set<ApiScope>>(new Set(["read", "write"]));
  const [revealed, setRevealed] = useState<{ name: string; key: string } | null>(null);
  const [formKey, setFormKey] = useState(0);

  const [state, action] = useActionState<ActionResult<unknown> | null, FormData>(async (_p, fd) => {
    const expiry = String(fd.get("expiresOn") ?? "");
    const res = await createApiKey({
      householdId,
      name: String(fd.get("name") ?? ""),
      scopes: [...scopes],
      // Expires at the end of the chosen day, household time.
      expiresAt: expiry ? (zonedInstant(expiry, "23:59", DEFAULT_TZ) ?? expiry) : null,
    });
    if (toastResult(res, t("apiKeys.created"))) {
      setRevealed({ name: res.data.name, key: res.data.key });
      setScopes(new Set(["read", "write"]));
      setFormKey((n) => n + 1);
    }
    return res;
  }, null);

  const toggle = (s: ApiScope, on: boolean) =>
    setScopes((prev) => {
      const next = new Set(prev);
      if (on) next.add(s);
      else next.delete(s);
      next.add("read");
      return next;
    });

  return (
    <div className="rounded-2xl border bg-card p-4">
      <form key={formKey} action={action} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="key-name">{t("apiKeys.name")}</Label>
            <Input
              id="key-name"
              name="name"
              required
              maxLength={60}
              placeholder={t("apiKeys.namePlaceholder")}
              aria-invalid={Boolean(fieldError(state, "name"))}
              className="h-10"
            />
            <FieldError message={fieldError(state, "name")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="key-expiry">
              {t("apiKeys.expires")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
            </Label>
            <Input
              id="key-expiry"
              name="expiresOn"
              type="date"
              min={todayKey()}
              aria-invalid={Boolean(fieldError(state, "expiresAt"))}
              className="h-10"
            />
            <FieldError message={fieldError(state, "expiresAt")} />
            {!fieldError(state, "expiresAt") ? (
              <p className="text-xs text-muted-foreground">{t("apiKeys.expiresHint")}</p>
            ) : null}
          </div>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{t("apiKeys.scopes")}</legend>
          {API_SCOPES.map((s) => (
            <label key={s} className="flex items-start gap-3 rounded-xl p-1.5 text-sm has-[:disabled]:opacity-80">
              <Checkbox
                checked={scopes.has(s)}
                disabled={s === "read"}
                onCheckedChange={(v) => toggle(s, v === true)}
                className="mt-0.5"
                aria-describedby={`scope-${s}-hint`}
              />
              <span>
                <span className="font-medium">{t(`apiKeys.scope.${s}` as MessageKey)}</span>
                <span id={`scope-${s}-hint`} className="block text-muted-foreground">
                  {t(`apiKeys.scope.${s}Hint` as MessageKey)}
                </span>
              </span>
            </label>
          ))}
          <FieldError message={fieldError(state, "scopes")} />
        </fieldset>

        <div>
          <SubmitButton className="h-10" pendingLabel={t("common.saving")}>
            <PlusIcon /> {t("apiKeys.createSubmit")}
          </SubmitButton>
        </div>
      </form>

      <RevealDialog revealed={revealed} onClose={() => setRevealed(null)} />
    </div>
  );
}

/** Shows the full key once. Closing it discards the secret from client state. */
function RevealDialog({ revealed, onClose }: { revealed: { name: string; key: string } | null; onClose: () => void }) {
  return (
    <Dialog open={revealed !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-5 text-primary" aria-hidden />
            {t("apiKeys.revealTitle")}
          </DialogTitle>
          <DialogDescription>{t("apiKeys.revealBody")}</DialogDescription>
        </DialogHeader>
        {revealed ? <CopyField value={revealed.key} label={revealed.name} /> : null}
        <DialogFooter>
          <Button onClick={onClose}>{t("apiKeys.revealDone")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- list ----------------------------------- */

function KeyRow({ householdId, apiKey }: { householdId: string; apiKey: ApiKeyRow }) {
  const [confirm, setConfirm] = useState(false);
  const active = apiKey.status === "active";
  return (
    <li className={cn("flex flex-wrap items-start gap-3 p-3 sm:flex-nowrap", !active && "opacity-70")}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{apiKey.name}</span>
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">fam_{apiKey.prefix}…</code>
          <Badge variant={active ? "secondary" : apiKey.status === "revoked" ? "destructive" : "outline"}>
            {t(`apiKeys.status.${apiKey.status}` as MessageKey)}
          </Badge>
        </p>
        <p className="mt-1 flex flex-wrap gap-1">
          {apiKey.scopes.map((s) => (
            <Badge key={s} variant="outline">
              {t(`apiKeys.scope.${s}` as MessageKey)}
            </Badge>
          ))}
        </p>
        <p className="mt-1 text-xs text-muted-foreground" suppressHydrationWarning>
          {t("apiKeys.createdOn", { when: ago(apiKey.createdAt) })} ·{" "}
          {apiKey.lastUsedAt ? t("apiKeys.lastUsed", { when: ago(apiKey.lastUsedAt) }) : t("apiKeys.neverUsed")} ·{" "}
          {apiKey.expiresAt ? t("apiKeys.expiresOn", { when: ago(apiKey.expiresAt) }) : t("apiKeys.noExpiry")}
        </p>
      </div>
      {apiKey.status !== "revoked" ? (
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirm(true)}>
          {t("apiKeys.revoke")}
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("apiKeys.revokeConfirm", { name: apiKey.name })}
        description={t("apiKeys.revokeBody")}
        confirmLabel={t("apiKeys.revoke")}
        onConfirm={async () => toastResult(await revokeApiKey(householdId, apiKey.id), t("apiKeys.revoked"))}
      />
    </li>
  );
}

/* ---------------------------------- skill ---------------------------------- */

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SkillPanel({ skill }: { skill: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(skill);
      setCopied(true);
      toast.success(t("skill.copied"));
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("error.title"));
    }
  }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />} {t("skill.copy")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => download(SKILL_FILENAME, new Blob([skill], { type: "text/markdown;charset=utf-8" }))}
        >
          <DownloadIcon /> {t("skill.download")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const zip = zipFiles({ [`${SKILL_DIR}/${SKILL_FILENAME}`]: skill });
            download(`${SKILL_DIR}.zip`, new Blob([zip.slice().buffer], { type: "application/zip" }));
          }}
        >
          <DownloadIcon /> {t("skill.downloadZip")}
        </Button>
      </div>
      <pre
        aria-label={t("skill.preview")}
        tabIndex={0}
        className="max-h-[28rem] overflow-auto rounded-2xl border bg-muted/50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words"
      >
        {skill}
      </pre>
    </div>
  );
}
