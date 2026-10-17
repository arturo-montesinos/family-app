import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { MailCheckIcon, TriangleAlertIcon } from "lucide-react";
import { auth, signIn } from "@/lib/auth";
import { AuthFrame } from "@/components/common/auth-frame";
import { SubmitButton } from "@/components/common/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type MessageKey } from "@/lib/i18n";

export const metadata = { title: "Sign in" };

const KNOWN_ERRORS = ["Verification", "AccessDenied", "Configuration", "EmailSignin"] as const;

function errorMessage(code: string | undefined): string | null {
  if (!code) return null;
  const known = KNOWN_ERRORS.find((k) => k.toLowerCase() === code.toLowerCase());
  return t((known ? `signin.error.${known}` : "signin.error.default") as MessageKey);
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; "check-email"?: string; error?: string; email?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallback(params.callbackUrl);
  const checkEmail = Boolean(params["check-email"]);
  const error = errorMessage(params.error);
  const fromInvite = callbackUrl.startsWith("/invite/");

  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  async function sendMagicLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const redirectTo = safeCallback(String(formData.get("callbackUrl") ?? ""));
    try {
      await signIn("resend", { email, redirectTo });
    } catch (err) {
      if (err instanceof AuthError) {
        const qs = new URLSearchParams({ error: err.type, callbackUrl: redirectTo });
        redirect(`/signin?${qs}`);
      }
      throw err; // NEXT_REDIRECT to the verify-request page
    }
  }

  if (checkEmail) {
    const retry = `/signin${callbackUrl !== "/dashboard" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`;
    return (
      <AuthFrame>
        <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-today text-today-foreground">
            <MailCheckIcon className="size-6" aria-hidden />
          </span>
          <h1 className="text-3xl font-semibold">{t("signin.checkTitle")}</h1>
          <p className="mt-3 text-[1.05rem] leading-relaxed text-muted-foreground">{t("signin.checkBody")}</p>
          <p className="mt-4 text-sm text-muted-foreground">{t("signin.checkSpam")}</p>
          <Link
            href={retry}
            className="mt-6 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("signin.useOther")}
          </Link>
        </section>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-semibold">{t("signin.title")}</h1>
        <p className="mt-2 text-[1.05rem] leading-relaxed text-muted-foreground">
          {fromInvite ? t("signin.inviteHint") : t("signin.lead")}
        </p>

        {error ? (
          <div
            role="alert"
            className="mt-5 flex gap-3 rounded-xl border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive"
          >
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{error}</p>
          </div>
        ) : null}

        <form action={sendMagicLink} className="mt-6 grid gap-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div className="grid gap-2">
            <Label htmlFor="email">{t("signin.email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t("signin.emailPlaceholder")}
              defaultValue={params.email ?? ""}
              required
              autoFocus
              className="h-12 text-base"
            />
          </div>
          <SubmitButton size="lg" className="h-12 text-base" pendingLabel={t("signin.sending")}>
            {t("signin.submit")}
          </SubmitButton>
        </form>
      </section>
      <p className="mt-4 px-2 text-sm text-muted-foreground">{t("app.tagline")}</p>
    </AuthFrame>
  );
}

/** Only allow same-origin relative redirects. */
function safeCallback(value: string | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return value;
  return "/dashboard";
}
