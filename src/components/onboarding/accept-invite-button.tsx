"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/lib/actions/invites";
import { toastResult } from "@/lib/action-client";
import { t } from "@/lib/i18n";

export function AcceptInviteButton({ token, householdName }: { token: string; householdName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      className="h-12 w-full text-base"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await acceptInvite(token);
          if (toastResult(res, t("invite.accepted", { household: householdName }))) {
            router.push("/dashboard");
            router.refresh();
          } else if (res.error.code === "conflict") {
            // Expired / used between page load and click: re-render the server state.
            router.refresh();
          }
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
      {pending ? t("invite.accepting") : t("invite.accept", { household: householdName })}
    </Button>
  );
}
