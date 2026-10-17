import { addMonths, addWeeks } from "date-fns";
import { getPageContext } from "@/lib/page-context";
import { listEventsInRange } from "@/lib/services/events";
import { CalendarView } from "@/components/calendar/calendar-view";
import { dayKey, DEFAULT_TZ, inTz, monthGridRange, parseDayKey, plainDate, todayKey, weekRange } from "@/lib/dates";

export const metadata = { title: "Calendar" };

type View = "month" | "week";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const params = await searchParams;
  const tz = DEFAULT_TZ;
  const view: View = params.view === "week" ? "week" : "month";
  const today = todayKey(tz);
  const anchor = parseDayKey(params.date, tz) ?? parseDayKey(today, tz)!;
  const anchorKey = dayKey(anchor, tz);

  const range = view === "month" ? monthGridRange(anchor, tz) : weekRange(anchor, tz);
  const ctx = await getPageContext();
  const occurrences = await listEventsInRange(ctx, { from: plainDate(range.from), to: plainDate(range.to), tz });

  const shift = (n: number) =>
    dayKey(view === "month" ? addMonths(anchor, n, { in: inTz(tz) }) : addWeeks(anchor, n, { in: inTz(tz) }), tz);
  const days = Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000);

  return (
    <CalendarView
      view={view}
      anchorKey={anchorKey}
      todayKey={today}
      rangeStartKey={dayKey(range.from, tz)}
      dayCount={view === "week" ? 7 : days}
      prevKey={shift(-1)}
      nextKey={shift(1)}
      occurrences={occurrences}
      members={ctx.members}
      me={ctx.me}
      actor={ctx.actor}
      tz={tz}
    />
  );
}
