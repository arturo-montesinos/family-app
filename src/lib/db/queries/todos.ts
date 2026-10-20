import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { todos, type NewTodo, type Todo, type TodoStatus } from "@/lib/db/schema";

type TodoFields = Omit<
  NewTodo,
  "id" | "householdId" | "createdBy" | "createdViaApiKeyId" | "createdAt" | "updatedAt"
>;

export type TodoFilter = { status?: TodoStatus; assignedTo?: string };

/** Open first, then by due date (nulls last), then newest. */
export async function listTodos(householdId: string, filter: TodoFilter = {}): Promise<Todo[]> {
  const conds: SQL[] = [eq(todos.householdId, householdId)];
  if (filter.status) conds.push(eq(todos.status, filter.status));
  if (filter.assignedTo) conds.push(eq(todos.assignedTo, filter.assignedTo));
  return db
    .select()
    .from(todos)
    .where(and(...conds))
    .orderBy(asc(todos.status), sql`${todos.dueAt} asc nulls last`, desc(todos.createdAt));
}

/** Open todos due before `before` (inclusive of overdue). For the dashboard. */
export async function listDueTodos(householdId: string, before: Date): Promise<Todo[]> {
  return db
    .select()
    .from(todos)
    .where(
      and(
        eq(todos.householdId, householdId),
        eq(todos.status, "open"),
        sql`${todos.dueAt} is not null and ${todos.dueAt} < ${before.toISOString()}::timestamptz`,
      ),
    )
    .orderBy(asc(todos.dueAt));
}

export async function getTodo(householdId: string, todoId: string): Promise<Todo | null> {
  const [row] = await db
    .select()
    .from(todos)
    .where(and(eq(todos.householdId, householdId), eq(todos.id, todoId)))
    .limit(1);
  return row ?? null;
}

export async function findTodoHouseholdId(todoId: string): Promise<string | null> {
  const [row] = await db
    .select({ householdId: todos.householdId })
    .from(todos)
    .where(eq(todos.id, todoId))
    .limit(1);
  return row?.householdId ?? null;
}

/** Keeps completedAt consistent with status. */
function withCompletion<T extends { status?: TodoStatus }>(patch: T): T & { completedAt?: Date | null } {
  if (patch.status === "done") return { ...patch, completedAt: new Date() };
  if (patch.status === "open") return { ...patch, completedAt: null };
  return patch;
}

export async function createTodo(
  householdId: string,
  createdBy: string,
  fields: TodoFields,
  createdViaApiKeyId: string | null = null,
): Promise<Todo> {
  const [row] = await db
    .insert(todos)
    .values({ ...withCompletion(fields), householdId, createdBy, createdViaApiKeyId })
    .returning();
  return row;
}

export async function updateTodo(
  householdId: string,
  todoId: string,
  patch: Partial<TodoFields>,
): Promise<Todo | null> {
  const [row] = await db
    .update(todos)
    .set(withCompletion(patch))
    .where(and(eq(todos.householdId, householdId), eq(todos.id, todoId)))
    .returning();
  return row ?? null;
}

/** Flips open↔done in a single statement (no read-modify-write race). */
export async function toggleTodo(householdId: string, todoId: string): Promise<Todo | null> {
  const [row] = await db
    .update(todos)
    .set({
      status: sql`case when ${todos.status} = 'open' then 'done'::todo_status else 'open'::todo_status end`,
      completedAt: sql`case when ${todos.status} = 'open' then now() else null end`,
    })
    .where(and(eq(todos.householdId, householdId), eq(todos.id, todoId)))
    .returning();
  return row ?? null;
}

export async function deleteTodo(householdId: string, todoId: string): Promise<boolean> {
  const rows = await db
    .delete(todos)
    .where(and(eq(todos.householdId, householdId), eq(todos.id, todoId)))
    .returning({ id: todos.id });
  return rows.length > 0;
}
