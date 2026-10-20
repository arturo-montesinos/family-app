import { withHouseholdApi } from "@/lib/api";
import * as todoService from "@/lib/services/todos";
import { todoCreateSchema, todoListQuerySchema } from "@/lib/validators";

/** GET /api/v1/households/:id/todos[?status=open|done&assignedTo=userId] */
export const GET = withHouseholdApi({ query: todoListQuerySchema, allowApiKeys: true }, (ctx) =>
  todoService.listTodos(ctx, ctx.query),
);

/** POST /api/v1/households/:id/todos */
export const POST = withHouseholdApi({ body: todoCreateSchema, status: 201, allowApiKeys: true }, (ctx) =>
  todoService.createTodo(ctx, ctx.body),
);
