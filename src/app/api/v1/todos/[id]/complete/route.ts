import { withEntityApi } from "@/lib/api";
import { findTodoHouseholdId } from "@/lib/db/queries/todos";
import * as todoService from "@/lib/services/todos";

/**
 * POST /api/v1/todos/:id/complete — marks the todo done (idempotent; unlike the web UI's
 * toggle, calling it twice never reopens). Reopen with PATCH `{ "status": "open" }`.
 */
export const POST = withEntityApi(
  { entity: "Todo", findHouseholdId: findTodoHouseholdId, allowApiKeys: true },
  (ctx) => todoService.updateTodo(ctx, ctx.id, { status: "done" }),
);
