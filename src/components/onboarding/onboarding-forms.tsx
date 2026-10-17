"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ColorPicker } from "@/components/common/color-picker";
import { FieldError } from "@/components/common/field-error";
import { SubmitButton } from "@/components/common/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createHousehold } from "@/lib/actions/households";
import type { ActionResult } from "@/lib/actions/types";
import { compact, fieldError, localError, toastResult } from "@/lib/action-client";
import { t } from "@/lib/i18n";
import { extractInviteToken } from "@/lib/invite-token";
import { MEMBER_COLORS } from "@/lib/members";

type CreateState = ActionResult<unknown> | null;

export function CreateHouseholdForm({ suggestedDisplayName }: { suggestedDisplayName: string }) {
  const router = useRouter();
  const [color, setColor] = useState<string | null>(MEMBER_COLORS[4]);
  const [state, formAction] = useActionState<CreateState, FormData>(async (_prev, fd) => {
    const res = await createHousehold(
      compact({
        name: String(fd.get("name") ?? ""),
        displayName: String(fd.get("displayName") ?? ""),
        color: color ?? "",
      }) as { name: string },
    );
    if (toastResult(res, t("onboarding.created"))) {
      router.push("/dashboard");
      router.refresh();
    }
    return res;
  }, null);

  return (
    <form action={formAction} className="mt-5 grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="hh-name">{t("onboarding.householdName")}</Label>
        <Input
          id="hh-name"
          name="name"
          required
          maxLength={80}
          placeholder={t("onboarding.householdPlaceholder")}
          aria-invalid={Boolean(fieldError(state, "name"))}
          aria-describedby="hh-name-err"
          className="h-11 text-base"
        />
        <FieldError id="hh-name-err" message={fieldError(state, "name")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="hh-display">{t("onboarding.displayName")}</Label>
        <Input
          id="hh-display"
          name="displayName"
          maxLength={60}
          defaultValue={suggestedDisplayName}
          placeholder={t("onboarding.displayPlaceholder")}
          aria-invalid={Boolean(fieldError(state, "displayName"))}
          className="h-11 text-base"
        />
        <FieldError message={fieldError(state, "displayName")} />
      </div>
      <div className="grid gap-2">
        <span className="text-sm font-medium">{t("onboarding.color")}</span>
        <ColorPicker value={color} onChange={setColor} label={t("onboarding.color")} />
        <FieldError message={fieldError(state, "color")} />
      </div>
      <SubmitButton size="lg" className="h-11" pendingLabel={t("common.saving")}>
        {t("onboarding.createSubmit")}
      </SubmitButton>
    </form>
  );
}

export function JoinWithInviteForm() {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult<never> | null, FormData>(async (_prev, fd) => {
    const token = extractInviteToken(String(fd.get("invite") ?? ""));
    if (!token) return localError("invite", t("onboarding.badLink"));
    router.push(`/invite/${token}`);
    return null;
  }, null);

  return (
    <form action={formAction} className="mt-4 grid gap-3">
      <Label htmlFor="invite" className="sr-only">
        {t("onboarding.inviteLink")}
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="invite"
          name="invite"
          required
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t("onboarding.invitePlaceholder")}
          aria-invalid={Boolean(fieldError(state, "invite"))}
          className="h-11 text-base"
        />
        <SubmitButton variant="secondary" className="h-11">
          {t("onboarding.joinSubmit")}
        </SubmitButton>
      </div>
      <FieldError message={fieldError(state, "invite")} />
    </form>
  );
}
