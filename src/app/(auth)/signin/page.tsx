import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Placeholder magic-link sign-in. UI agent: restyle freely, keep the server action.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; "check-email"?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallback(params.callbackUrl);

  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  async function sendMagicLink(formData: FormData) {
    "use server";
    await signIn("resend", {
      email: String(formData.get("email") ?? ""),
      redirectTo: safeCallback(String(formData.get("callbackUrl") ?? "")),
    });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Family App</CardTitle>
          <CardDescription>
            {params["check-email"]
              ? "Check your inbox — we sent you a sign-in link."
              : "We'll email you a magic link."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={sendMagicLink} className="grid gap-4">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            {params.error ? (
              <p className="text-sm text-destructive">Sign-in failed. Please try again.</p>
            ) : null}
            <Button type="submit">Send magic link</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

/** Only allow same-origin relative redirects. */
function safeCallback(value: string | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}
