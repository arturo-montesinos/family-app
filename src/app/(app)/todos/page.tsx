import { getPageContext } from "@/lib/page-context";
import { listTodos } from "@/lib/services/todos";
import { TodoBoard } from "@/components/todos/todo-board";

export const metadata = { title: "Todos" };

export default async function TodosPage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const { who } = await searchParams;
  const ctx = await getPageContext();
  const filter = who && ctx.members.some((m) => m.userId === who) ? who : who === "none" ? "none" : "all";
  const todos = await listTodos(ctx);
  return <TodoBoard todos={todos} members={ctx.members} me={ctx.me} actor={ctx.actor} filter={filter} />;
}
