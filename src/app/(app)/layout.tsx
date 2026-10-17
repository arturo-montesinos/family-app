import { signOut } from "@/lib/auth";
import { getMyHouseholds } from "@/lib/household";
import { getPageContext } from "@/lib/page-context";
import { SidebarNav, TabBar } from "@/components/shell/app-nav";
import { FamilyStrip, HouseholdSwitcher } from "@/components/shell/household-switcher";
import { UserMenu } from "@/components/shell/user-menu";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Authenticated shell: sidebar on md+, top bar + bottom tab bar on phones. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [ctx, households] = await Promise.all([getPageContext(), getMyHouseholds()]);
  const switcherHouseholds = households.map((h) => ({ id: h.id, name: h.name, role: h.role }));
  const memberColors = ctx.members.map((m) => m.color);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/signin" });
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
        <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-sidebar p-3 md:flex">
          <HouseholdSwitcher households={switcherHouseholds} activeId={ctx.householdId} memberColors={memberColors} />
          <SidebarNav />
          <div className="mt-auto">
            <UserMenu me={ctx.me} email={ctx.user.email} signOutAction={signOutAction} showName />
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur md:hidden">
            <div className="flex items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2">
              <HouseholdSwitcher
                households={switcherHouseholds}
                activeId={ctx.householdId}
                memberColors={memberColors}
                compact
              />
              <UserMenu me={ctx.me} email={ctx.user.email} signOutAction={signOutAction} />
            </div>
            <FamilyStrip colors={memberColors} className="h-1 gap-0.5 px-4 pb-0" />
          </header>

          <main id="main" className="mx-auto w-full max-w-5xl px-4 pt-5 pb-28 sm:px-6 md:px-8 md:pt-8 md:pb-12">
            {children}
          </main>
        </div>
        <TabBar />
      </div>
    </TooltipProvider>
  );
}
