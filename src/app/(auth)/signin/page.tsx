import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { MailCheckIcon, TriangleAlertIcon } from "lucide-react";
import { auth, googleEnabled, signIn } from "@/lib/auth";
import { AuthFrame } from "@/components/common/auth-frame";
import { SubmitButton } from "@/components/common/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type MessageKey } from "@/lib/i18n";

export const metadata = { title: "Sign in" };

const KNOWN_ERRORS = [
  "Verification",
  "AccessDenied",
  "Configuration",
  "EmailSignin",
  "OAuthAccountNotLinked",
] as const;

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

  async function continueWithGoogle(formData: FormData) {
    "use server";
    const redirectTo = safeCallback(String(formData.get("callbackUrl") ?? ""));
    try {
      await signIn("google", { redirectTo });
    } catch (err) {
      if (err instanceof AuthError) {
        const qs = new URLSearchParams({ error: err.type, callbackUrl: redirectTo });
        redirect(`/signin?${qs}`);
      }
      throw err; // NEXT_REDIRECT to Google
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

        {googleEnabled ? (
          <>
            <form action={continueWithGoogle} className="mt-6">
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
              <SubmitButton
                size="lg"
                variant="outline"
                className="h-12 w-full gap-3 text-base"
                pendingLabel={t("signin.redirecting")}
              >
                <GoogleMark />
                {t("signin.google")}
              </SubmitButton>
            </form>
            <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t("signin.or")}
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        ) : null}

        <form action={sendMagicLink} className={googleEnabled ? "mt-4 grid gap-4" : "mt-6 grid gap-4"}>
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
              autoFocus={!googleEnabled}
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

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
