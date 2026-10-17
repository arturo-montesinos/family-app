"use client";

import { useActionState, useState } from "react";
import { Trash2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FieldError } from "@/components/common/field-error";
import { MemberAvatar } from "@/components/common/member-avatar";
import { SubmitButton } from "@/components/common/submit-button";
import { createTodo, deleteTodo, updateTodo } from "@/lib/actions/todos";
import type { ActionResult } from "@/lib/actions/types";
import { fieldError, localError, toastResult } from "@/lib/action-client";
import type { Todo } from "@/lib/db/schema";
import { DEFAULT_TZ, todoDueFromForm, todoDueToForm } from "@/lib/dates";
import { t } from "@/lib/i18n";
import type { FamilyMember } from "@/lib/members";
import { canAssignTodo, canDelete, type Actor } from "@/lib/permissions";

const NONE = "__none__";

/** `todo` = edit it; `"new"` = create; null = closed. */
export function TodoDialog({
  todo,
  onClose,
  members,
  actor,
  tz = DEFAULT_TZ,
}: {
  todo: Todo | "new" | null;
  onClose: () => void;
  members: FamilyMember[];
  actor: Actor;
  tz?: string;
}) {
  return (
    <Dialog open={todo !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        {todo ? (
          <TodoForm
            key={todo === "new" ? "new" : todo.id}
            todo={todo === "new" ? null : todo}
            onClose={onClose}
            members={members}
            actor={actor}
            tz={tz}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TodoForm({
  todo,
  onClose,
  members,
  actor,
  tz,
}: {
  todo: Todo | null;
  onClose: () => void;
  members: FamilyMember[];
  actor: Actor;
  tz: string;
}) {
  const initialDue = todoDueToForm(todo?.dueAt ?? null, tz);
  const [assignee, setAssignee] = useState<string>(todo?.assignedTo ?? NONE);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const assignable = members.filter((m) => canAssignTodo(actor, m.userId));

  const [state, formAction] = useActionState<ActionResult<unknown> | null, FormData>(async (_p, fd) => {
    const title = String(fd.get("title") ?? "").trim();
    if (!title) return localError("title", "Title is required");
    const date = String(fd.get("dueDate") ?? "");
    const time = String(fd.get("dueTime") ?? "");
    const payload = {
      title,
      details: String(fd.get("details") ?? "") || null,
      dueAt: todoDueFromForm(date, time, tz)?.toISOString() ?? null,
      assignedTo: assignee === NONE ? null : assignee,
    };
    const res = todo ? await updateTodo(todo.id, payload) : await createTodo(payload);
    if (toastResult(res, todo ? t("todos.updated") : t("todos.added"))) onClose();
    return res;
  }, null);

  return (
    <form action={formAction} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{todo ? t("todos.edit") : t("todos.newTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("todos.edit")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="td-title">{t("todos.titleLabel")}</Label>
        <Input
          id="td-title"
          name="title"
          defaultValue={todo?.title}
          maxLength={200}
          required
          autoFocus={!todo}
          aria-invalid={Boolean(fieldError(state, "title"))}
          className="h-11 text-base"
        />
        <FieldError message={fieldError(state, "title")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="td-assignee">{t("todos.assignee")}</Label>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger id="td-assignee" className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("common.unassigned")}</SelectItem>
            {assignable.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                <MemberAvatar member={m} size="xs" /> {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={fieldError(state, "assignedTo")} />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="grid gap-2">
          <Label htmlFor="td-due">
            {t("todos.due")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
          </Label>
          <Input id="td-due" name="dueDate" type="date" defaultValue={initialDue.date} className="h-11" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="td-time">{t("todos.dueTime")}</Label>
          <Input id="td-time" name="dueTime" type="time" defaultValue={initialDue.time} className="h-11 w-32" />
        </div>
        <FieldError message={fieldError(state, "dueAt")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="td-details">
          {t("todos.details")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
        </Label>
        <Textarea id="td-details" name="details" defaultValue={todo?.details ?? ""} rows={3} maxLength={5000} />
        <FieldError message={fieldError(state, "details")} />
      </div>
      <DialogFooter className="gap-2 sm:justify-between">
        {todo && canDelete(actor, todo) ? (
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2Icon /> {t("common.delete")}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <SubmitButton pendingLabel={t("common.saving")}>{todo ? t("common.save") : t("common.add")}</SubmitButton>
        </div>
      </DialogFooter>
      {todo ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t("todos.deleteConfirm")}
          description={todo.title}
          confirmLabel={t("common.delete")}
          onConfirm={async () => {
            const res = await deleteTodo(todo.id);
            if (toastResult(res, t("todos.deleted"))) onClose();
            return res.ok;
          }}
        />
      ) : null}
    </form>
  );
}
