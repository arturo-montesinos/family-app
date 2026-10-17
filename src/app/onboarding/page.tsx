import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { getMyHouseholds } from "@/lib/household";
import { AuthFrame } from "@/components/common/auth-frame";
import { CreateHouseholdForm, JoinWithInviteForm } from "@/components/onboarding/onboarding-forms";
import { t } from "@/lib/i18n";

export const metadata = { title: "Set up" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const households = await getMyHouseholds();
  const suggestedName = user.name?.split(" ")[0] ?? "";

  return (
    <AuthFrame>
      <h1 className="text-3xl font-semibold">{t("onboarding.title")}</h1>
      <p className="mt-2 text-[1.05rem] leading-relaxed text-muted-foreground">{t("onboarding.lead")}</p>

      <section className="mt-6 rounded-3xl border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">{t("onboarding.create")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.createLead")}</p>
        <CreateHouseholdForm suggestedDisplayName={suggestedName} />
      </section>

      <section className="mt-4 rounded-3xl border bg-card/60 p-6">
        <h2 className="text-xl font-semibold">{t("onboarding.join")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.joinLead")}</p>
        <JoinWithInviteForm />
      </section>

      {households.length > 0 ? (
        <Link
          href="/dashboard"
          className="mt-6 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("onboarding.back")}
        </Link>
      ) : null}
    </AuthFrame>
  );
}
