import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { getMyHouseholds } from "@/lib/household";
import { countHouseholds, isAdminEmail } from "@/lib/access";
import { AuthFrame } from "@/components/common/auth-frame";
import { CreateHouseholdForm, JoinWithInviteForm } from "@/components/onboarding/onboarding-forms";
import { t } from "@/lib/i18n";

export const metadata = { title: "Set up" };

/**
 * Single-household app: only the administrator (ADMIN_EMAIL) can create the household,
 * and only once. Everyone else joins through an invite link from the administrator.
 */
export default async function OnboardingPage() {
  const user = await requireUser();
  const households = await getMyHouseholds();
  const isAdmin = isAdminEmail(user.email);
  const canCreate = isAdmin && (await countHouseholds()) === 0;
  const suggestedName = user.name?.split(" ")[0] ?? "";

  return (
    <AuthFrame>
      <h1 className="text-3xl font-semibold">
        {canCreate ? t("onboarding.title") : t("onboarding.inviteOnlyTitle")}
      </h1>
      <p className="mt-2 text-[1.05rem] leading-relaxed text-muted-foreground">
        {canCreate ? t("onboarding.adminLead") : t("onboarding.inviteOnlyLead")}
      </p>

      {canCreate ? (
        <section className="mt-6 rounded-3xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">{t("onboarding.create")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.createLead")}</p>
          <CreateHouseholdForm suggestedDisplayName={suggestedName} />
        </section>
      ) : (
        <section className="mt-6 rounded-3xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">{t("onboarding.join")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.joinLead")}</p>
          <JoinWithInviteForm />
        </section>
      )}

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
