"use client";

import { useActionState, useState, useTransition } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { EllipsisIcon, PencilIcon, PinIcon, PinOffIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { ViaAgent } from "@/components/common/agent-names";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FieldError } from "@/components/common/field-error";
import { MemberAvatar } from "@/components/common/member-avatar";
import { SubmitButton } from "@/components/common/submit-button";
import { deletePost, togglePin, updatePost } from "@/lib/actions/posts";
import type { ActionResult } from "@/lib/actions/types";
import { fieldError, toastResult } from "@/lib/action-client";
import type { PostWithAuthor } from "@/lib/db/queries/posts";
import { dateLocale, t } from "@/lib/i18n";
import type { FamilyMember } from "@/lib/members";
import { canDelete, canEdit, canPinPost, type Actor } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function PostCard({
  post,
  author,
  actor,
  compact,
}: {
  post: PostWithAuthor;
  author: FamilyMember | undefined;
  actor: Actor;
  /** Dashboard variant: no actions, clamped body. */
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pinPending, startPin] = useTransition();
  const color = author?.color ?? "var(--muted-foreground)";
  const name = author?.name ?? post.authorName ?? t("common.someone");
  const mayEdit = !compact && canEdit(actor, post);
  const mayDelete = !compact && canDelete(actor, post);
  const mayPin = !compact && canPinPost(actor);
  const created = new Date(post.createdAt);
  const edited = new Date(post.updatedAt).getTime() - created.getTime() > 60_000;

  const [state, saveAction] = useActionState<ActionResult<unknown> | null, FormData>(async (_p, fd) => {
    const res = await updatePost(post.id, { body: String(fd.get("body") ?? "") });
    if (toastResult(res, t("board.updated"))) setEditing(false);
    return res;
  }, null);

  return (
    <article
      className={cn(
        "relative flex flex-col overflow-visible rounded-2xl border bg-card p-4 pt-5",
        post.pinned && "shadow-[0_8px_20px_-14px_rgba(29,43,51,0.45)]",
      )}
    >
      <span aria-hidden className="absolute inset-x-4 top-0 h-1 rounded-b-full" style={{ backgroundColor: color }} />
      {post.pinned ? (
        <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full bg-today px-2 py-0.5 text-xs font-semibold text-today-foreground">
          <PinIcon className="size-3" aria-hidden /> {t("board.pinned")}
        </span>
      ) : null}

      {editing ? (
        <form action={saveAction} className="grid gap-2">
          <Textarea
            name="body"
            defaultValue={post.body}
            rows={4}
            maxLength={5000}
            autoFocus
            aria-label={t("common.edit")}
            aria-invalid={Boolean(fieldError(state, "body"))}
          />
          <FieldError message={fieldError(state, "body")} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              {t("common.cancel")}
            </Button>
            <SubmitButton size="sm" pendingLabel={t("common.saving")}>
              {t("common.save")}
            </SubmitButton>
          </div>
        </form>
      ) : (
        <p className={cn("text-[1.02rem] leading-relaxed break-words whitespace-pre-wrap", compact && "line-clamp-4")}>
          {post.body}
        </p>
      )}

      <footer className="mt-4 flex items-center gap-2 text-sm">
        <MemberAvatar member={author ?? null} size="sm" title={name} />
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          <span className="font-medium text-foreground">{name}</span>{" "}
          {post.createdViaApiKeyId ? (
            <>
              <ViaAgent keyId={post.createdViaApiKeyId} />{" "}
            </>
          ) : null}
          <time dateTime={created.toISOString()} suppressHydrationWarning>
            {formatDistanceToNowStrict(created, { addSuffix: true, locale: dateLocale })}
          </time>
          {edited ? ` (${t("board.edited")})` : ""}
        </span>
        {mayEdit || mayDelete || mayPin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("common.moreActions")} disabled={pinPending}>
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {mayPin ? (
                <DropdownMenuItem
                  onSelect={() =>
                    startPin(async () => {
                      toastResult(await togglePin(post.id), post.pinned ? t("board.unpinnedToast") : t("board.pinnedToast"));
                    })
                  }
                >
                  {post.pinned ? <PinOffIcon /> : <PinIcon />}
                  {post.pinned ? t("board.unpin") : t("board.pin")}
                </DropdownMenuItem>
              ) : null}
              {mayEdit ? (
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <PencilIcon /> {t("common.edit")}
                </DropdownMenuItem>
              ) : null}
              {mayDelete ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                    <Trash2Icon /> {t("common.delete")}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </footer>

      {mayDelete ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t("board.deleteConfirm")}
          description={post.body.slice(0, 140)}
          confirmLabel={t("common.delete")}
          onConfirm={async () => toastResult(await deletePost(post.id), t("board.deleted"))}
        />
      ) : null}
    </article>
  );
}
