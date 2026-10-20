import { ForbiddenError } from "@/lib/errors";
import type { MemberRole } from "@/lib/db/schema";

/**
 * Role rules (PLAN.md "Auth & authorization"). Pure: no DB, no server-only.
 *
 *  - owner: everything an adult can do + manage the household, members, invites,
 *           agent API keys, and view the activity (audit) log.
 *  - adult: create / edit / delete any event, todo or post in the household; pin posts.
 *  - child: create events, todos and posts; edit/delete only content they created;
 *           complete (toggle) todos they created or that are assigned to them;
 *           can only assign todos to themselves (or nobody); cannot pin posts.
 *  - everyone: edit their own member color / display name, leave the household
 *              (except the last owner).
 */

export type Actor = { userId: string; role: MemberRole };

export type ContentKind = "event" | "todo" | "post";

/** Minimal row shapes, so callers can pass full Drizzle rows or partial selections. */
export type EventRowLike = { createdBy: string | null };
export type TodoRowLike = { createdBy: string | null; assignedTo: string | null };
export type PostRowLike = { authorId: string | null };
export type ContentRowLike = EventRowLike | TodoRowLike | PostRowLike;

export type Action =
  | "household:update"
  | "household:delete"
  | "member:manage" // change role / remove other members
  | "invite:manage"
  | "api_key:manage" // create / list / revoke agent API keys
  | "audit:view" // activity log
  | "content:create"
  | "content:update"
  | "content:delete"
  | "todo:toggle"
  | "post:pin";

export const isOwner = (a: Actor) => a.role === "owner";
export const isAdultOrOwner = (a: Actor) => a.role === "owner" || a.role === "adult";

/** The user who "owns" a content row (creator / author). */
export function contentOwnerId(row: ContentRowLike): string | null {
  if ("authorId" in row) return row.authorId;
  return row.createdBy;
}

export function isCreator(actor: Actor, row: ContentRowLike): boolean {
  const owner = contentOwnerId(row);
  return owner !== null && owner === actor.userId;
}

/* ------------------------------ household -------------------------------- */

export const canManageHousehold = (actor: Actor) => isOwner(actor);
export const canManageMembers = (actor: Actor) => isOwner(actor);
export const canManageInvites = (actor: Actor) => isOwner(actor);
/** Agent API keys act with the owner's powers, so only the owner manages them. */
export const canManageApiKeys = (actor: Actor) => isOwner(actor);
export const canViewAudit = (actor: Actor) => isOwner(actor);

/**
 * Only the owner invites, and never as owner: the administrator is the single owner
 * and the only person who controls access.
 */
export function canInviteRole(actor: Actor, role: MemberRole): boolean {
  return isOwner(actor) && role !== "owner";
}

/* ------------------------------- content --------------------------------- */

/** Every member (owner, adult, child) may create events, todos and posts. */
export function canCreate(actor: Actor, kind?: ContentKind): boolean {
  void kind;
  return ["owner", "adult", "child"].includes(actor.role);
}

export function canEdit(actor: Actor, row: ContentRowLike): boolean {
  return isAdultOrOwner(actor) || isCreator(actor, row);
}

export function canDelete(actor: Actor, row: ContentRowLike): boolean {
  return isAdultOrOwner(actor) || isCreator(actor, row);
}

export function canToggleTodo(actor: Actor, todo: TodoRowLike): boolean {
  return isAdultOrOwner(actor) || isCreator(actor, todo) || todo.assignedTo === actor.userId;
}

/** Children may only assign todos to themselves or leave them unassigned. */
export function canAssignTodo(actor: Actor, assignee: string | null | undefined): boolean {
  if (assignee === undefined || assignee === null) return true;
  return isAdultOrOwner(actor) || assignee === actor.userId;
}

export const canPinPost = (actor: Actor) => isAdultOrOwner(actor);

/* ------------------------------- members --------------------------------- */

export type MemberLike = { userId: string; role: MemberRole };

/**
 * Change another member's role. Owner only. The last owner can't be demoted
 * (`ownerCount` = current number of owners in the household).
 */
export function canChangeRole(
  actor: Actor,
  target: MemberLike,
  newRole: MemberRole,
  ownerCount: number,
): boolean {
  if (!isOwner(actor)) return false;
  // Single-owner model: nobody can be promoted to owner.
  if (newRole === "owner" && target.role !== "owner") return false;
  if (target.role === "owner" && newRole !== "owner" && ownerCount <= 1) return false;
  return true;
}

/** Color / display name: yourself, or anyone if you're the owner. */
export function canUpdateMemberProfile(actor: Actor, target: MemberLike): boolean {
  return isOwner(actor) || actor.userId === target.userId;
}

/** Owner removes anyone; anyone may leave. The last owner can never be removed. */
export function canRemoveMember(actor: Actor, target: MemberLike, ownerCount: number): boolean {
  if (target.role === "owner" && ownerCount <= 1) return false;
  return isOwner(actor) || actor.userId === target.userId;
}

/* ------------------------------- generic --------------------------------- */

/**
 * Generic check used by `assertCan`. `row` is required for content:update/delete,
 * todo:toggle.
 */
export function can(actor: Actor, action: Action, row?: ContentRowLike): boolean {
  switch (action) {
    case "household:update":
    case "household:delete":
      return canManageHousehold(actor);
    case "member:manage":
      return canManageMembers(actor);
    case "invite:manage":
      return canManageInvites(actor);
    case "api_key:manage":
      return canManageApiKeys(actor);
    case "audit:view":
      return canViewAudit(actor);
    case "content:create":
      return canCreate(actor);
    case "content:update":
      return row ? canEdit(actor, row) : isAdultOrOwner(actor);
    case "content:delete":
      return row ? canDelete(actor, row) : isAdultOrOwner(actor);
    case "todo:toggle":
      return row && !("authorId" in row) && "assignedTo" in row
        ? canToggleTodo(actor, row)
        : isAdultOrOwner(actor);
    case "post:pin":
      return canPinPost(actor);
  }
}

const DEFAULT_MESSAGES: Record<Action, string> = {
  "household:update": "Only the household owner can change the household",
  "household:delete": "Only the household owner can delete the household",
  "member:manage": "Only the household owner can manage members",
  "invite:manage": "Only the household owner can manage invites",
  "api_key:manage": "Only the household owner can manage API keys",
  "audit:view": "Only the household owner can view activity",
  "content:create": "You can't create this",
  "content:update": "You can only edit your own items",
  "content:delete": "You can only delete your own items",
  "todo:toggle": "You can only complete your own or assigned todos",
  "post:pin": "Only adults can pin posts",
};

/** Throws ForbiddenError when `actor` may not perform `action`. */
export function assertCan(actor: Actor, action: Action, row?: ContentRowLike, message?: string): void {
  if (!can(actor, action, row)) throw new ForbiddenError(message ?? DEFAULT_MESSAGES[action]);
}

/** Throws ForbiddenError unless `allowed`. Use with the specific `canX` helpers. */
export function assertAllowed(allowed: boolean, message = "You don't have permission to do that"): void {
  if (!allowed) throw new ForbiddenError(message);
}
