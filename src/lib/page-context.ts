import "server-only";
import { cache } from "react";
import { requireActiveHousehold } from "@/lib/household";
import { toFamilyMember, type FamilyMember } from "@/lib/members";
import type { Actor } from "@/lib/permissions";
import { listMembers } from "@/lib/services/households";

export type PageContext = Awaited<ReturnType<typeof requireActiveHousehold>> & {
  members: FamilyMember[];
  me: FamilyMember;
  actor: Actor;
};

/**
 * Everything most (app) pages need: active household ctx, the household's members as
 * client-safe `FamilyMember`s, the current member and a permissions `Actor`. Cached per
 * request so the layout and page share one lookup.
 */
export const getPageContext = cache(async (): Promise<PageContext> => {
  const ctx = await requireActiveHousehold();
  const rows = await listMembers(ctx);
  const members = rows.map(toFamilyMember);
  const me =
    members.find((m) => m.userId === ctx.user.id) ??
    toFamilyMember({ ...ctx.member, name: ctx.user.name, email: ctx.user.email, image: ctx.user.image });
  return { ...ctx, members, me, actor: { userId: ctx.user.id, role: ctx.member.role } };
});
