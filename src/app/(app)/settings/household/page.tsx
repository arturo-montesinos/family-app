import { getActiveHousehold } from "@/lib/household";
import { getPageContext } from "@/lib/page-context";
import { canManageInvites } from "@/lib/permissions";
import { inviteUrl, listInvites } from "@/lib/services/invites";
import { HouseholdSettings } from "@/components/household/household-settings";

export const metadata = { title: "Household settings" };

export default async function HouseholdSettingsPage() {
  const ctx = await getPageContext();
  const household = await getActiveHousehold();
  const isOwner = canManageInvites(ctx.actor);
  const invites = isOwner ? await listInvites(ctx) : [];

  return (
    <HouseholdSettings
      householdId={ctx.householdId}
      householdName={household?.name ?? ""}
      members={ctx.members}
      me={ctx.me}
      actor={ctx.actor}
      invites={invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt.toISOString(),
        url: inviteUrl(i.token),
      }))}
    />
  );
}
