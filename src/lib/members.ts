import type { MemberRole } from "@/lib/db/schema";

/**
 * Client-safe member shape passed from server pages to client components, plus color
 * helpers. Pure module (no DB imports at runtime: the schema import is type-only).
 */
export type FamilyMember = {
  userId: string;
  name: string;
  displayName: string | null;
  email: string | null;
  image: string | null;
  color: string;
  /** True when `color` was derived (member hasn't picked one). */
  colorIsDefault: boolean;
  role: MemberRole;
};

/** Member color swatches — saturated enough to read as chips on both themes. */
export const MEMBER_COLORS = [
  "#d9485f", // raspberry
  "#ef7d32", // pumpkin
  "#d9a400", // mustard
  "#4f9d3a", // grass
  "#1f8a7a", // teal
  "#3f7cc4", // lake
  "#5b5fc7", // indigo
  "#9256c4", // plum
  "#c4508f", // berry
  "#8a6d55", // bark
] as const;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Stable fallback color for a member who hasn't picked one. */
export const defaultColorFor = (userId: string) => MEMBER_COLORS[hash(userId) % MEMBER_COLORS.length];

/** Black or white text, whichever reads better on `hex`. */
export function readableOn(hex: string): "#ffffff" | "#1d2b33" {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.36 ? "#1d2b33" : "#ffffff";
}

export function initials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type MemberRowLike = {
  userId: string;
  role: MemberRole;
  color: string | null;
  displayName: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
};

export function toFamilyMember(m: MemberRowLike): FamilyMember {
  const name = m.displayName?.trim() || m.name?.trim() || m.email?.split("@")[0] || "Member";
  return {
    userId: m.userId,
    name,
    displayName: m.displayName,
    email: m.email,
    image: m.image,
    color: m.color ?? defaultColorFor(m.userId),
    colorIsDefault: !m.color,
    role: m.role,
  };
}

export function memberMap(members: FamilyMember[]): Map<string, FamilyMember> {
  return new Map(members.map((m) => [m.userId, m]));
}

/** Color for an event: explicit color, else the single attendee's, else the creator's. */
export function eventColor(
  ev: { color: string | null; attendeeIds: string[]; createdBy: string | null },
  byId: Map<string, FamilyMember>,
): string {
  if (ev.color) return ev.color;
  if (ev.attendeeIds.length === 1) {
    const m = byId.get(ev.attendeeIds[0]);
    if (m) return m.color;
  }
  if (ev.attendeeIds.length > 1) return "var(--primary)";
  const creator = ev.createdBy ? byId.get(ev.createdBy) : undefined;
  return creator?.color ?? "var(--primary)";
}
