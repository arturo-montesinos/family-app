import { t } from "@/lib/i18n";
import { MEMBER_COLORS } from "@/lib/members";

/**
 * Frame for signed-out / pre-household screens (sign-in, onboarding, invite): app mark,
 * a small "week on the fridge" illustration made from member colours, and a card slot.
 */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 pt-[max(env(safe-area-inset-top),2.5rem)] pb-10 sm:justify-center sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <AppMark />
          <span className="font-display text-xl font-semibold tracking-tight">{t("app.name")}</span>
        </div>
        {children}
        <WeekDoodle className="mt-10" />
      </div>
    </main>
  );
}

export function AppMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className ?? "size-10"} aria-hidden>
      <rect width="64" height="64" rx="16" fill="var(--primary)" />
      <rect x="12" y="16" width="40" height="36" rx="7" fill="var(--primary-foreground)" />
      <rect x="12" y="16" width="40" height="10" rx="5" fill="var(--today)" />
      <circle cx="23" cy="38" r="4.5" fill="#d9485f" />
      <circle cx="35" cy="38" r="4.5" fill="#3f7cc4" />
      <rect x="40" y="34" width="6" height="8" rx="3" fill="#4f9d3a" />
    </svg>
  );
}

/** Seven little day columns with colourful blocks: what a family week looks like. */
function WeekDoodle({ className }: { className?: string }) {
  const days = [
    [0, 5],
    [3],
    [1, 6, 4],
    [5],
    [2, 0],
    [7, 3, 1],
    [4],
  ];
  return (
    <div aria-hidden className={className}>
      <div className="grid grid-cols-7 gap-1.5 opacity-80">
        {days.map((blocks, i) => (
          <div key={i} className="flex h-16 flex-col gap-1 rounded-lg bg-card/70 p-1">
            {blocks.map((c, j) => (
              <span
                key={j}
                className="h-2.5 rounded-full"
                style={{ backgroundColor: MEMBER_COLORS[c], width: `${60 + ((i + j) % 3) * 20}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
