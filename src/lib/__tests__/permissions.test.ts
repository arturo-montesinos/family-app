import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import {
  assertCan,
  can,
  canAssignTodo,
  canChangeRole,
  canDelete,
  canEdit,
  canInviteRole,
  canManageHousehold,
  canManageInvites,
  canManageMembers,
  canPinPost,
  canRemoveMember,
  canToggleTodo,
  canUpdateMemberProfile,
  type Actor,
} from "@/lib/permissions";

const owner: Actor = { userId: "u-owner", role: "owner" };
const adult: Actor = { userId: "u-adult", role: "adult" };
const child: Actor = { userId: "u-child", role: "child" };
const otherChild: Actor = { userId: "u-child2", role: "child" };

const ownedBy = (id: string) => ({ createdBy: id });
const postBy = (id: string | null) => ({ authorId: id });
const todo = (createdBy: string | null, assignedTo: string | null) => ({ createdBy, assignedTo });

describe("household management", () => {
  it.each([
    [owner, true],
    [adult, false],
    [child, false],
  ])("%o manage household/members/invites → %s", (actor, expected) => {
    expect(canManageHousehold(actor)).toBe(expected);
    expect(canManageMembers(actor)).toBe(expected);
    expect(canManageInvites(actor)).toBe(expected);
    expect(canInviteRole(actor, "adult")).toBe(expected);
    expect(can(actor, "household:update")).toBe(expected);
    expect(can(actor, "invite:manage")).toBe(expected);
  });
});

describe("content edit/delete matrix", () => {
  const rows = {
    ownersEvent: ownedBy(owner.userId),
    childsEvent: ownedBy(child.userId),
    orphan: ownedBy(null as unknown as string), // creator deleted (set null)
    ownersPost: postBy(owner.userId),
    childsPost: postBy(child.userId),
    deletedAuthorPost: postBy(null),
  };

  const matrix: [Actor, keyof typeof rows, boolean][] = [
    [owner, "ownersEvent", true],
    [owner, "childsEvent", true],
    [owner, "orphan", true],
    [adult, "ownersEvent", true],
    [adult, "childsPost", true],
    [adult, "deletedAuthorPost", true],
    [child, "childsEvent", true],
    [child, "childsPost", true],
    [child, "ownersEvent", false],
    [child, "ownersPost", false],
    [child, "orphan", false],
    [child, "deletedAuthorPost", false],
    [otherChild, "childsEvent", false],
  ];

  it.each(matrix)("%o on %s → %s", (actor, rowKey, expected) => {
    expect(canEdit(actor, rows[rowKey])).toBe(expected);
    expect(canDelete(actor, rows[rowKey])).toBe(expected);
    expect(can(actor, "content:update", rows[rowKey])).toBe(expected);
    expect(can(actor, "content:delete", rows[rowKey])).toBe(expected);
  });

  it("everyone can create", () => {
    for (const a of [owner, adult, child]) expect(can(a, "content:create")).toBe(true);
  });
});

describe("todos", () => {
  it("toggle: adults always, child only own or assigned", () => {
    const parentsTodo = todo(owner.userId, null);
    const assignedToChild = todo(owner.userId, child.userId);
    const childsOwn = todo(child.userId, null);
    expect(canToggleTodo(adult, parentsTodo)).toBe(true);
    expect(canToggleTodo(child, parentsTodo)).toBe(false);
    expect(canToggleTodo(child, assignedToChild)).toBe(true);
    expect(canToggleTodo(child, childsOwn)).toBe(true);
    expect(canToggleTodo(otherChild, assignedToChild)).toBe(false);
    expect(can(child, "todo:toggle", assignedToChild)).toBe(true);
    expect(can(child, "todo:toggle", parentsTodo)).toBe(false);
  });

  it("assignee may complete but not edit a todo they didn't create", () => {
    const assignedToChild = todo(owner.userId, child.userId);
    expect(canEdit(child, assignedToChild)).toBe(false);
    expect(canDelete(child, assignedToChild)).toBe(false);
  });

  it("children can only assign to themselves or nobody", () => {
    expect(canAssignTodo(child, null)).toBe(true);
    expect(canAssignTodo(child, undefined)).toBe(true);
    expect(canAssignTodo(child, child.userId)).toBe(true);
    expect(canAssignTodo(child, adult.userId)).toBe(false);
    expect(canAssignTodo(adult, child.userId)).toBe(true);
  });
});

describe("posts", () => {
  it("only adults/owner can pin", () => {
    expect(canPinPost(owner)).toBe(true);
    expect(canPinPost(adult)).toBe(true);
    expect(canPinPost(child)).toBe(false);
  });
});

describe("members", () => {
  const ownerM = { userId: owner.userId, role: "owner" as const };
  const adultM = { userId: adult.userId, role: "adult" as const };
  const childM = { userId: child.userId, role: "child" as const };

  it("only owner changes roles; last owner can't be demoted", () => {
    expect(canChangeRole(owner, adultM, "child", 1)).toBe(true);
    expect(canChangeRole(owner, adultM, "owner", 1)).toBe(true);
    expect(canChangeRole(adult, childM, "adult", 1)).toBe(false);
    expect(canChangeRole(owner, ownerM, "adult", 1)).toBe(false);
    expect(canChangeRole(owner, ownerM, "adult", 2)).toBe(true);
  });

  it("profile: self or owner", () => {
    expect(canUpdateMemberProfile(child, childM)).toBe(true);
    expect(canUpdateMemberProfile(child, adultM)).toBe(false);
    expect(canUpdateMemberProfile(adult, childM)).toBe(false);
    expect(canUpdateMemberProfile(owner, childM)).toBe(true);
  });

  it("remove: owner removes anyone, anyone leaves, never the last owner", () => {
    expect(canRemoveMember(owner, childM, 1)).toBe(true);
    expect(canRemoveMember(adult, childM, 1)).toBe(false);
    expect(canRemoveMember(child, childM, 1)).toBe(true);
    expect(canRemoveMember(owner, ownerM, 1)).toBe(false);
    expect(canRemoveMember(owner, ownerM, 2)).toBe(true);
  });
});

describe("assertCan", () => {
  it("throws ForbiddenError with status 403", () => {
    expect(() => assertCan(child, "post:pin")).toThrow(ForbiddenError);
    try {
      assertCan(child, "member:manage");
    } catch (e) {
      expect((e as ForbiddenError).status).toBe(403);
    }
    expect(() => assertCan(owner, "member:manage")).not.toThrow();
  });
});
