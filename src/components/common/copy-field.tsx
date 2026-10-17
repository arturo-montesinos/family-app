"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";

export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(t("common.copied"));
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(value);
    }
  }
  return (
    <div className="flex gap-2">
      <Input
        readOnly
        value={value}
        aria-label={label ?? t("onboarding.inviteLink")}
        onFocus={(e) => e.currentTarget.select()}
        className="font-mono text-xs"
      />
      <Button type="button" variant="secondary" onClick={copy} className="shrink-0">
        {copied ? <CheckIcon /> : <CopyIcon />}
        {t("common.copy")}
      </Button>
    </div>
  );
}
