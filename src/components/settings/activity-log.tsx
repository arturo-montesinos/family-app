"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { BotIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MemberAvatar } from "@/components/common/member-avatar";
import { PageHeader } from "@/components/common/page-header";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit";
import { DEFAULT_TZ, formatDate, formatTime } from "@/lib/dates";
import { t, type MessageKey } from "@/lib/i18n";
import { memberMap, type FamilyMember } from "@/lib/members";
import { cn } from "@/lib/utils";

export type ActivityRow = {
  id: string;
  occurredAt: string;
  actorType: "user" | "api_key";
  actorUserId: string | null;
  actorName: string | null;
  apiKeyName: string | null;
  action: string;
  entityType: string;
  summary: string;
};

const ALL = "__all__";

function actionLabel(action: string): string {
  const key = `activity.action.${action}` as MessageKey;
  const label = t(key);
  return label === key ? action : label;
}

export function ActivityLog({
  rows,
  page,
  pageCount,
  total,
  filters,
  members,
  keys,
}: {
  rows: ActivityRow[];
  page: number;
  pageCount: number;
  total: number;
  filters: { actor: string; entity: string };
  members: FamilyMember[];
  keys: { id: string; name: string; prefix: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const byId = memberMap(members);

  const href = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const setFilter = (k: "actor" | "entity", v: string) =>
    start(() => router.push(href({ [k]: v === ALL ? null : v, page: null })));

  return (
    <div className="max-w-4xl">
      <PageHeader title={t("activity.title")} />
      <p className="-mt-2 mb-6 text-sm text-muted-foreground">{t("activity.lead")}</p>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 sm:max-w-xl">
        <label className="grid gap-1.5 text-sm font-medium">
          {t("activity.filterActor")}
          <Select value={filters.actor || ALL} onValueChange={(v) => setFilter("actor", v)}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("activity.allActors")}</SelectItem>
              <SelectGroup>
                <SelectLabel>{t("settings.members")}</SelectLabel>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={`user:${m.userId}`}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectGroup>
              {keys.length ? (
                <SelectGroup>
                  <SelectLabel>{t("apiKeys.title")}</SelectLabel>
                  {keys.map((k) => (
                    <SelectItem key={k.id} value={`key:${k.id}`}>
                      {k.name} (fam_{k.prefix}…)
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("activity.filterEntity")}
          <Select value={filters.entity || ALL} onValueChange={(v) => setFilter("entity", v)}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("activity.allEntities")}</SelectItem>
              {AUDIT_ENTITY_TYPES.map((e) => (
                <SelectItem key={e} value={e}>
                  {t(`activity.entity.${e}` as MessageKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className={cn("rounded-2xl border bg-card transition-opacity", pending && "opacity-60")}>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{t("activity.empty")}</p>
        ) : (
          <>
            {/* Table on sm+, stacked list on phones. */}
            <table className="hidden w-full text-sm sm:table">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">{t("activity.when")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("activity.who")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("activity.action")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("activity.details")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      <When iso={r.occurredAt} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Who row={r} member={r.actorUserId ? byId.get(r.actorUserId) : undefined} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{actionLabel(r.action)}</td>
                    <td className="max-w-xs truncate px-3 py-2.5 text-muted-foreground" title={r.summary}>
                      {r.summary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y sm:hidden">
              {rows.map((r) => (
                <li key={r.id} className="grid gap-1 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Who row={r} member={r.actorUserId ? byId.get(r.actorUserId) : undefined} />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      <When iso={r.occurredAt} />
                    </span>
                  </div>
                  <p>
                    {actionLabel(r.action)}
                    {r.summary ? <span className="text-muted-foreground">: {r.summary}</span> : null}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {total > 0 ? (
        <nav className="mt-4 flex items-center justify-between gap-2 text-sm" aria-label={t("activity.title")}>
          <PageLink href={page > 1 ? href({ page: page > 2 ? String(page - 1) : null }) : null}>
            <ChevronLeftIcon /> {t("activity.prev")}
          </PageLink>
          <span className="text-muted-foreground">{t("activity.page", { page, pages: pageCount })}</span>
          <PageLink href={page < pageCount ? href({ page: String(page + 1) }) : null}>
            {t("activity.next")} <ChevronRightIcon />
          </PageLink>
        </nav>
      ) : null}
    </div>
  );
}

function PageLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={href} scroll={false}>
        {children}
      </Link>
    </Button>
  );
}

function When({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {formatDate(d, false, DEFAULT_TZ, "MMM d")}, {formatTime(d, DEFAULT_TZ)}
    </time>
  );
}

function Who({ row, member }: { row: ActivityRow; member: FamilyMember | undefined }) {
  const person = member?.name ?? row.actorName ?? t("common.someone");
  if (row.actorType === "api_key") {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
          <BotIcon className="size-3.5" aria-hidden />
        </span>
        <span className="truncate">
          {t("activity.byKey", { key: row.apiKeyName ?? t("agent.unknownKey"), user: person })}
        </span>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-2">
      <MemberAvatar member={member ?? null} size="sm" title={person} />
      <span className="truncate">{person}</span>
    </span>
  );
}
