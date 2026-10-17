/**
 * Maps the event dialog's simple "Repeats" select to RRULE strings and back. Anything we
 * don't recognize (e.g. rules created via the API) is reported as "custom" and preserved.
 */
export const RECURRENCE_PRESETS = ["none", "daily", "weekly", "biweekly", "monthly"] as const;
export type RecurrencePreset = (typeof RECURRENCE_PRESETS)[number];

const RULES: Record<Exclude<RecurrencePreset, "none">, string> = {
  daily: "FREQ=DAILY",
  weekly: "FREQ=WEEKLY",
  biweekly: "FREQ=WEEKLY;INTERVAL=2",
  monthly: "FREQ=MONTHLY",
};

export function presetToRRule(preset: RecurrencePreset): string | null {
  return preset === "none" ? null : RULES[preset];
}

export function rruleToPreset(rule: string | null | undefined): RecurrencePreset | "custom" {
  if (!rule) return "none";
  const body = rule
    .replace(/^RRULE:/i, "")
    .trim()
    .toUpperCase();
  const parts = Object.fromEntries(
    body
      .split(";")
      .filter(Boolean)
      .map((p) => p.split("=") as [string, string]),
  );
  const keys = Object.keys(parts).filter((k) => k !== "WKST");
  const interval = parts.INTERVAL ?? "1";
  const only = (...allowed: string[]) => keys.every((k) => allowed.includes(k));
  if (!only("FREQ", "INTERVAL")) return "custom";
  if (parts.FREQ === "DAILY" && interval === "1") return "daily";
  if (parts.FREQ === "WEEKLY" && interval === "1") return "weekly";
  if (parts.FREQ === "WEEKLY" && interval === "2") return "biweekly";
  if (parts.FREQ === "MONTHLY" && interval === "1") return "monthly";
  return "custom";
}
