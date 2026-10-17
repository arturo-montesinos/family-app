"use server";

import * as todoQueries from "@/lib/db/queries/todos";
import type { Todo } from "@/lib/db/schema";
import { resolveByEntity } from "@/lib/services/context";
import * as todoService from "@/lib/services/todos";
import { todoCreateSchema, todoUpdateSchema } from "@/lib/validators";
import { parse, resolveHouseholdFromInput, revalidate, ROUTES, run, type ActionResult } from "./_utils";

type TodoInput = {
  householdId?: string;
  title: string;
  details?: string | null;
  dueAt?: string | Date | null;
  assignedTo?: string | null;
  status?: "open" | "done";
};

const revalidateTodos = () => revalidate(ROUTES.todos, ROUTES.dashboard);

/** Creates a todo in `input.householdId` (default: active household). */
export async function createTodo(input: TodoInput | FormData): Promise<ActionResult<Todo>> {
  return run(async () => {
    const data = parse(todoCreateSchema, input);
    const ctx = await resolveHouseholdFromInput(input);
    const row = await todoService.createTodo(ctx, data);
    revalidateTodos();
    return row;
  });
}

export async function updateTodo(
  todoId: string,
  input: Partial<Omit<TodoInput, "householdId">> | FormData,
): Promise<ActionResult<Todo>> {
  return run(async () => {
    const data = parse(todoUpdateSchema, input);
    const ctx = await resolveByEntity(todoId, "Todo", todoQueries.findTodoHouseholdId);
    const row = await todoService.updateTodo(ctx, todoId, data);
    revalidateTodos();
    return row;
  });
}

/** Flips open↔done (sets/clears completedAt). Allowed for adults, the creator, or the assignee. */
export async function toggleTodo(todoId: string): Promise<ActionResult<Todo>> {
  return run(async () => {
    const ctx = await resolveByEntity(todoId, "Todo", todoQueries.findTodoHouseholdId);
    const row = await todoService.toggleTodo(ctx, todoId);
    revalidateTodos();
    return row;
  });
}

export async function deleteTodo(todoId: string): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await resolveByEntity(todoId, "Todo", todoQueries.findTodoHouseholdId);
    const result = await todoService.deleteTodo(ctx, todoId);
    revalidateTodos();
    return result;
  });
}
