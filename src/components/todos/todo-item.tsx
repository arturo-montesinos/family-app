"use client";

import { useOptimistic, useTransition } from "react";
import { CalendarClockIcon, CheckIcon } from "lucide-react";
import { ViaAgent } from "@/components/common/agent-names";
import { MemberAvatar } from "@/components/common/member-avatar";
import { toggleTodo } from "@/lib/actions/todos";
import { toastResult } from "@/lib/action-client";
import type { Todo } from "@/lib/db/schema";
import { DEFAULT_TZ, dueState, formatDue } from "@/lib/dates";
import { t } from "@/lib/i18n";
import type { FamilyMember } from "@/lib/members";
import { canEdit, canToggleTodo, type Actor } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/** One todo row: round checkbox in the assignee's colour, title, due chip, avatar. */
export function TodoItem({
  todo,
  byId,
  actor,
  onEdit,
  tz = DEFAULT_TZ,
}: {
  todo: Todo;
  byId: Map<string, FamilyMember>;
  actor: Actor;
  onEdit?: (todo: Todo) => void;
  tz?: string;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useOptimistic(todo.status === "done");
  const assignee = todo.assignedTo ? byId.get(todo.assignedTo) : undefined;
  const color = assignee?.color ?? "var(--primary)";
  const mayToggle = canToggleTodo(actor, todo);
  const mayEdit = canEdit(actor, todo) && onEdit;
  const due = todo.dueAt ? new Date(todo.dueAt) : null;
  const state = due && !done ? dueState(due, new Date(), tz) : null;

  return (
    <div className={cn("flex items-start gap-3 rounded-xl px-2 py-2", pending && "opacity-70")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? t("todos.markOpen", { title: todo.title }) : t("todos.markDone", { title: todo.title })}
        disabled={!mayToggle || pending}
        onClick={() =>
          start(async () => {
            setDone(!done);
            toastResult(await toggleTodo(todo.id));
          })
        }
        className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: color, backgroundColor: done ? color : "transparent" }}
      >
        {done ? <CheckIcon className="size-3.5 text-white" strokeWidth={3} aria-hidden /> : null}
      </button>
      <div className="min-w-0 flex-1">
        {mayEdit ? (
          <button
            type="button"
            onClick={() => onEdit(todo)}
            className={cn(
              "block w-full text-left text-[0.97rem] leading-snug outline-none focus-visible:underline",
              done && "text-muted-foreground line-through decoration-muted-foreground/60",
            )}
          >
            {todo.title}
          </button>
        ) : (
          <p className={cn("text-[0.97rem] leading-snug", done && "text-muted-foreground line-through")}>{todo.title}</p>
        )}
        {todo.details && !done ? <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{todo.details}</p> : null}
        {todo.createdViaApiKeyId && !done ? <ViaAgent keyId={todo.createdViaApiKeyId} className="block text-xs" /> : null}
        {due && !done ? (
          <span
            className={cn(
              "mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
              state === "overdue" && "bg-destructive/12 text-destructive",
              state === "today" && "bg-today/30 text-today-foreground dark:text-today",
              (state === "tomorrow" || state === "later") && "bg-muted text-muted-foreground",
            )}
          >
            <CalendarClockIcon className="size-3" aria-hidden />
            {state === "overdue" ? `${t("todos.overdue")} · ` : ""}
            {formatDue(due, { today: t("todos.dueToday"), tomorrow: t("todos.dueTomorrow") }, new Date(), tz)}
          </span>
        ) : null}
      </div>
      {assignee ? <MemberAvatar member={assignee} size="sm" className="mt-0.5" /> : null}
    </div>
  );
}
