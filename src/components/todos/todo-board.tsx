"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, ListChecksIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/empty-state";
import { FieldError } from "@/components/common/field-error";
import { MemberAvatar } from "@/components/common/member-avatar";
import { PageHeader } from "@/components/common/page-header";
import { createTodo } from "@/lib/actions/todos";
import type { ActionResult } from "@/lib/actions/types";
import { fieldError, toastResult } from "@/lib/action-client";
import type { Todo } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { memberMap, type FamilyMember } from "@/lib/members";
import { canAssignTodo, type Actor } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { TodoDialog } from "./todo-dialog";
import { TodoItem } from "./todo-item";

export function TodoBoard({
  todos,
  members,
  me,
  actor,
  filter,
}: {
  todos: Todo[];
  members: FamilyMember[];
  me: FamilyMember;
  actor: Actor;
  /** "all" | "none" | userId */
  filter: string;
}) {
  const byId = useMemo(() => memberMap(members), [members]);
  const [editing, setEditing] = useState<Todo | "new" | null>(null);
  const [showDone, setShowDone] = useState(false);

  const visible = todos.filter((td) =>
    filter === "all" ? true : filter === "none" ? !td.assignedTo : td.assignedTo === filter,
  );
  const open = visible.filter((td) => td.status === "open");
  const done = visible
    .filter((td) => td.status === "done")
    .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime());

  // New todos default to whoever is being filtered on (if allowed), so "Maëlle's list" + add = hers.
  const defaultAssignee = filter !== "all" && filter !== "none" && canAssignTodo(actor, filter) ? filter : null;

  return (
    <div>
      <PageHeader title={t("todos.title")}>
        <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
          <PlusIcon /> {t("todos.newTitle")}
        </Button>
      </PageHeader>

      <nav aria-label={t("todos.filter")} className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2">
          <FilterChip href="/todos" active={filter === "all"} label={t("common.all")} />
          {members.map((m) => (
            <FilterChip
              key={m.userId}
              href={`/todos?who=${encodeURIComponent(m.userId)}`}
              active={filter === m.userId}
              label={m.userId === me.userId ? `${m.name} (${t("common.you")})` : m.name}
              member={m}
            />
          ))}
          <FilterChip href="/todos?who=none" active={filter === "none"} label={t("common.unassigned")} />
        </ul>
      </nav>

      <section className="rounded-2xl border bg-card p-2 sm:p-3">
        <QuickAdd assignedTo={defaultAssignee} />
        <h2 className="sr-only">{t("todos.open")}</h2>
        {open.length === 0 ? (
          <EmptyState
            icon={ListChecksIcon}
            title={filter === "all" ? t("todos.empty") : t("todos.emptyFiltered")}
            className="m-2 border-none"
          />
        ) : (
          <ul className="mt-1 divide-y divide-border/60">
            {open.map((td) => (
              <li key={td.id}>
                <TodoItem todo={td} byId={byId} actor={actor} onEdit={setEditing} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2>
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            aria-expanded={showDone}
            className="flex items-center gap-1.5 rounded-lg px-1 py-1 font-sans text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronDownIcon className={cn("size-4 transition-transform", !showDone && "-rotate-90")} aria-hidden />
            {t("todos.done")} <span className="tabular-nums">({done.length})</span>
          </button>
        </h2>
        {showDone ? (
          done.length === 0 ? (
            <p className="px-1 py-3 text-sm text-muted-foreground">{t("todos.doneEmpty")}</p>
          ) : (
            <ul className="mt-2 divide-y divide-border/60 rounded-2xl border bg-card/60 p-2">
              {done.map((td) => (
                <li key={td.id}>
                  <TodoItem todo={td} byId={byId} actor={actor} onEdit={setEditing} />
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      <TodoDialog todo={editing} onClose={() => setEditing(null)} members={members} actor={actor} />
    </div>
  );
}

function FilterChip({ href, active, label, member }: { href: string; active: boolean; label: string; member?: FamilyMember }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        scroll={false}
        className={cn(
          "flex h-9 items-center gap-2 rounded-full border px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          member && "pl-1",
          active ? "border-foreground bg-foreground text-background" : "bg-card text-foreground hover:bg-accent",
        )}
      >
        {member ? <MemberAvatar member={member} size="sm" /> : null}
        {label}
      </Link>
    </li>
  );
}

function QuickAdd({ assignedTo }: { assignedTo: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState<ActionResult<unknown> | null, FormData>(async (_p, fd) => {
    const title = String(fd.get("title") ?? "").trim();
    if (!title) return null;
    const res = await createTodo({ title, assignedTo });
    if (toastResult(res)) {
      if (inputRef.current) inputRef.current.value = "";
      inputRef.current?.focus();
    }
    return res;
  }, null);
  return (
    <form action={formAction} className="px-1 pt-1 pb-2">
      <div className="flex items-center gap-2 rounded-xl bg-muted/60 pl-3 focus-within:ring-[3px] focus-within:ring-ring/40">
        <PlusIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <Input
          ref={inputRef}
          name="title"
          aria-label={t("todos.addPlaceholder")}
          placeholder={t("todos.addPlaceholder")}
          maxLength={200}
          autoComplete="off"
          enterKeyHint="done"
          disabled={pending}
          className="h-12 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <Button type="submit" size="sm" variant="ghost" disabled={pending} className="mr-1.5">
          {t("common.add")}
        </Button>
      </div>
      <FieldError message={fieldError(state, "title")} />
    </form>
  );
}
