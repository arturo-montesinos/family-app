import { addDays } from "date-fns";
import { getPageContext } from "@/lib/page-context";
import { listDueTodos } from "@/lib/db/queries/todos";
import { listEventsInRange } from "@/lib/services/events";
import { listPosts } from "@/lib/services/posts";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { DEFAULT_TZ, inTz, parseDayKey, plainDate, todayKey } from "@/lib/dates";

export const metadata = { title: "Today" };

export default async function DashboardPage() {
  const tz = DEFAULT_TZ;
  const ctx = await getPageContext();
  const todayStart = parseDayKey(todayKey(tz), tz)!;
  const today = plainDate(todayStart);
  const weekEnd = plainDate(addDays(todayStart, 8, { in: inTz(tz) })); // today + next 7 days

  const [occurrences, dueTodos, pinned] = await Promise.all([
    listEventsInRange(ctx, { from: today, to: weekEnd, tz }),
    listDueTodos(ctx.householdId, weekEnd),
    listPosts(ctx, { pinned: true, limit: 6 }),
  ]);

  return (
    <DashboardView
      todayKey={todayKey(tz)}
      occurrences={occurrences}
      dueTodos={dueTodos}
      pinned={pinned}
      members={ctx.members}
      me={ctx.me}
      actor={ctx.actor}
      tz={tz}
    />
  );
}
