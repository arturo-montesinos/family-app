import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { HourglassIcon, LinkIcon, MailOpenIcon, TicketCheckIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getInviteDetails } from "@/lib/services/invites";
import { AuthFrame } from "@/components/common/auth-frame";
import { AcceptInviteButton } from "@/components/onboarding/accept-invite-button";
import { buttonVariants } from "@/components/ui/button";
import { dateLocale, t, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const metadata = { title: "Invite" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const validShape = /^[A-Za-z0-9_-]{16,128}$/.test(token);
  const [invite, user] = await Promise.all([
    validShape ? getInviteDetails(token) : Promise.resolve(null),
    getCurrentUser(),
  ]);

  if (!invite) {
    return (
      <InviteProblem icon={LinkIcon} title={t("invite.notFound")} body={t("invite.notFoundBody")} signedIn={!!user} />
    );
  }
  if (invite.status === "expired") {
    return <InviteProblem icon={HourglassIcon} title={t("invite.expired")} body={t("invite.expiredBody")} signedIn={!!user} />;
  }
  if (invite.status === "accepted") {
    return <InviteProblem icon={TicketCheckIcon} title={t("invite.used")} body={t("invite.usedBody")} signedIn={!!user} />;
  }

  const role = t(`role.${invite.role}` as MessageKey).toLowerCase();
  const callback = `/invite/${token}`;
  const emailMatches = user?.email?.toLowerCase() === invite.email.toLowerCase();

  return (
    <AuthFrame>
      <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-today text-today-foreground">
          <MailOpenIcon className="size-6" aria-hidden />
        </span>
        <p className="text-sm font-medium text-muted-foreground">{t("invite.title")}</p>
        <h1 className="mt-1 text-3xl font-semibold">{invite.householdName}</h1>
        <p className="mt-3 text-[1.05rem] text-muted-foreground">
          {t("invite.body", { household: invite.householdName, role: `${aOrAn(role)} ${role}` })}
        </p>
        <dl className="mt-5 grid gap-1 text-sm text-muted-foreground">
          <dd>{t("invite.sentTo", { email: invite.email })}</dd>
          <dd>
            {t("invite.expires", {
              when: formatDistanceToNowStrict(invite.expiresAt, { addSuffix: true, locale: dateLocale }),
            })}
          </dd>
        </dl>

        <div className="mt-6">
          {!user ? (
            <>
              <Link
                href={`/signin?${new URLSearchParams({ callbackUrl: callback, email: invite.email })}`}
                className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}
              >
                {t("invite.signInFirst")}
              </Link>
              <p className="mt-3 text-sm text-muted-foreground">{t("invite.signInHint", { email: invite.email })}</p>
            </>
          ) : (
            <>
              {!emailMatches ? (
                <p className="mb-3 rounded-xl bg-muted p-3 text-sm">
                  {t("invite.wrongEmail", { current: user.email ?? "?", email: invite.email })}
                </p>
              ) : null}
              <AcceptInviteButton token={token} householdName={invite.householdName} />
            </>
          )}
        </div>
      </section>
    </AuthFrame>
  );
}

function aOrAn(word: string) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function InviteProblem({
  icon: Icon,
  title,
  body,
  signedIn,
}: {
  icon: typeof LinkIcon;
  title: string;
  body: string;
  signedIn: boolean;
}) {
  return (
    <AuthFrame>
      <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <Icon className="size-6" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{body}</p>
        <Link
          href={signedIn ? "/dashboard" : "/signin"}
          className={cn(buttonVariants({ variant: "secondary" }), "mt-6")}
        >
          {signedIn ? t("invite.goDashboard") : t("signin.title")}
        </Link>
      </section>
    </AuthFrame>
  );
}
