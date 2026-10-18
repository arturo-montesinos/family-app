import "server-only";
import * as memberQueries from "@/lib/db/queries/members";
import * as todoQueries from "@/lib/db/queries/todos";
import { BadRequestError, NotFoundError, assertUuid } from "@/lib/errors";
import { assertAllowed, assertCan, canAssignTodo, canToggleTodo } from "@/lib/permissions";
import type { TodoCreateInput, TodoListQuery, TodoUpdateInput } from "@/lib/validators";
import { changedFields } from "@/lib/audit";
import type { Todo } from "@/lib/db/schema";
import { audit } from "./audit";
import { actorOf, type HouseholdCtx } from "./context";

const statusAction = (row: Todo) => (row.status === "done" ? "todo.complete" : "todo.reopen");

async function checkAssignee(ctx: HouseholdCtx, assignee: string | null | undefined) {
  if (assignee === undefined || assignee === null) return;
  assertAllowed(canAssignTodo(actorOf(ctx), assignee), "You can only assign todos to yourself");
  const ok = await memberQueries.filterMemberIds(ctx.member.householdId, [assignee]);
  if (ok.length === 0) throw new BadRequestError("Assignee must be a household member");
}

export function listTodos(ctx: HouseholdCtx, filter: TodoListQuery = {}) {
  return todoQueries.listTodos(ctx.member.householdId, filter);
}

export async function getTodo(ctx: HouseholdCtx, todoId: string) {
  assertUuid(todoId, "Todo");
  const row = await todoQueries.getTodo(ctx.member.householdId, todoId);
  if (!row) throw new NotFoundError("Todo not found");
  return row;
}

export async function createTodo(ctx: HouseholdCtx, input: TodoCreateInput) {
  assertCan(actorOf(ctx), "content:create");
  await checkAssignee(ctx, input.assignedTo);
  const row = await todoQueries.createTodo(
    ctx.member.householdId,
    ctx.user.id,
    {
      title: input.title,
      details: input.details ?? null,
      dueAt: input.dueAt ?? null,
      assignedTo: input.assignedTo ?? null,
      status: input.status,
    },
    ctx.via?.id ?? null,
  );
  await audit(ctx, "todo.create", {
    entityId: row.id,
    summary: row.title,
    metadata: { assignedTo: row.assignedTo, dueAt: row.dueAt?.toISOString() ?? null },
  });
  return row;
}

/**
 * Full edit: adults/owner or the creator. A child who is merely the assignee may only
 * change `status` (i.e. complete it).
 */
export async function updateTodo(ctx: HouseholdCtx, todoId: string, input: TodoUpdateInput) {
  const existing = await getTodo(ctx, todoId);
  const actor = actorOf(ctx);
  const onlyStatus = Object.entries(input).every(([k, v]) => k === "status" || v === undefined);
  if (onlyStatus) {
    assertAllowed(canToggleTodo(actor, existing), "You can only complete your own or assigned todos");
  } else {
    assertCan(actor, "content:update", existing);
  }
  if (input.assignedTo !== undefined && input.assignedTo !== existing.assignedTo) {
    await checkAssignee(ctx, input.assignedTo);
  }
  const row = await todoQueries.updateTodo(ctx.member.householdId, todoId, input);
  if (!row) throw new NotFoundError("Todo not found");
  await audit(ctx, onlyStatus ? statusAction(row) : "todo.update", {
    entityId: row.id,
    summary: row.title,
    metadata: onlyStatus ? null : { changed: changedFields(input) },
  });
  return row;
}

export async function toggleTodo(ctx: HouseholdCtx, todoId: string) {
  const existing = await getTodo(ctx, todoId);
  assertCan(actorOf(ctx), "todo:toggle", existing);
  const row = await todoQueries.toggleTodo(ctx.member.householdId, todoId);
  if (!row) throw new NotFoundError("Todo not found");
  await audit(ctx, statusAction(row), { entityId: row.id, summary: row.title });
  return row;
}

export async function deleteTodo(ctx: HouseholdCtx, todoId: string) {
  const existing = await getTodo(ctx, todoId);
  assertCan(actorOf(ctx), "content:delete", existing);
  await todoQueries.deleteTodo(ctx.member.householdId, todoId);
  await audit(ctx, "todo.delete", { entityId: todoId, summary: existing.title });
  return { id: todoId };
}
