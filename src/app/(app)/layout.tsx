import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

// Placeholder authenticated shell. UI agent: replace with sidebar + household switcher.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="font-semibold">
            Family App
          </Link>
        </nav>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
          className="flex items-center gap-3 text-sm"
        >
          <span className="text-muted-foreground">{user.name ?? user.email}</span>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
