import { getPageContext } from "@/lib/page-context";
import { canManageApiKeys } from "@/lib/permissions";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getPageContext();
  return (
    <>
      <SettingsNav isOwner={canManageApiKeys(ctx.actor)} />
      {children}
    </>
  );
}
