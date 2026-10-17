import { withEntityApi } from "@/lib/api";
import { findTodoHouseholdId } from "@/lib/db/queries/todos";
import * as todoService from "@/lib/services/todos";
import { todoUpdateSchema } from "@/lib/validators";

const entity = { entity: "Todo", findHouseholdId: findTodoHouseholdId };

/** GET /api/v1/todos/:id */
export const GET = withEntityApi(entity, (ctx) => todoService.getTodo(ctx, ctx.id));

/** PATCH /api/v1/todos/:id — `{ status }` alone is allowed for the assignee (completion). */
export const PATCH = withEntityApi({ ...entity, body: todoUpdateSchema }, (ctx) =>
  todoService.updateTodo(ctx, ctx.id, ctx.body),
);

/** DELETE /api/v1/todos/:id */
export const DELETE = withEntityApi(entity, (ctx) => todoService.deleteTodo(ctx, ctx.id));
