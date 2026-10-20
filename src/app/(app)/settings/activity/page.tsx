import { notFound } from "next/navigation";
import { getPageContext } from "@/lib/page-context";
import { canViewAudit } from "@/lib/permissions";
import { listApiKeys } from "@/lib/services/api-keys";
import { listActivity } from "@/lib/services/audit";
import { auditQuerySchema, parseActorFilter } from "@/lib/validators";
import { ActivityLog } from "@/components/settings/activity-log";

export const metadata = { title: "Activity" };

/** Owner only: everyone else gets a 404. */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getPageContext();
  if (!canViewAudit(ctx.actor)) notFound();

  const q = auditQuerySchema.parse(await searchParams);
  const [activity, keys] = await Promise.all([
    listActivity(ctx, { ...parseActorFilter(q.actor), entityType: q.entity }, q.page ?? 1),
    listApiKeys(ctx),
  ]);

  return (
    <ActivityLog
      rows={activity.rows.map((r) => ({
        id: r.id,
        occurredAt: r.occurredAt.toISOString(),
        actorType: r.actorType,
        actorUserId: r.actorUserId,
        actorName: r.actorDisplayName || r.actorName,
        apiKeyName: r.apiKeyName,
        action: r.action,
        entityType: r.entityType,
        summary: r.summary,
      }))}
      page={activity.page}
      pageCount={activity.pageCount}
      total={activity.total}
      filters={{ actor: q.actor ?? "", entity: q.entity ?? "" }}
      members={ctx.members}
      keys={keys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix }))}
    />
  );
}
