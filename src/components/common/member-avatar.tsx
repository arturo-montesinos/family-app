import { cn } from "@/lib/utils";
import { initials, readableOn, type FamilyMember } from "@/lib/members";

const SIZES = {
  xs: "size-5 text-[0.55rem]",
  sm: "size-7 text-[0.68rem]",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
} as const;

type Props = {
  member: Pick<FamilyMember, "name" | "color"> | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
  /** Adds a ring in the page background colour so stacked avatars separate. */
  ring?: boolean;
  title?: string;
};

/** Colour + initials avatar. Unknown / removed members render as a muted "?". */
export function MemberAvatar({ member, size = "md", className, ring, title }: Props) {
  const color = member?.color ?? "var(--muted)";
  const label = member?.name ?? "?";
  return (
    <span
      role="img"
      aria-label={title ?? label}
      title={title ?? label}
      className={cn(
        "inline-grid shrink-0 select-none place-items-center rounded-full font-semibold leading-none tracking-tight",
        SIZES[size],
        ring && "ring-2 ring-background",
        !member && "text-muted-foreground",
        className,
      )}
      style={{ backgroundColor: color, color: member ? readableOn(member.color) : undefined }}
    >
      {member ? initials(label) : "?"}
    </span>
  );
}

/** Overlapping stack of avatars, e.g. event attendees. */
export function AvatarStack({
  members,
  max = 4,
  size = "sm",
  className,
}: {
  members: FamilyMember[];
  max?: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <span className={cn("inline-flex items-center -space-x-1.5", className)}>
      {shown.map((m) => (
        <MemberAvatar key={m.userId} member={m} size={size} ring />
      ))}
      {extra > 0 ? (
        <span
          className={cn(
            "inline-grid place-items-center rounded-full bg-muted font-semibold text-muted-foreground ring-2 ring-background",
            SIZES[size],
          )}
        >
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
