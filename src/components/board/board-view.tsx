"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { StickyNoteIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/common/empty-state";
import { FieldError } from "@/components/common/field-error";
import { MemberAvatar } from "@/components/common/member-avatar";
import { PageHeader } from "@/components/common/page-header";
import { SubmitButton } from "@/components/common/submit-button";
import { createPost } from "@/lib/actions/posts";
import type { ActionResult } from "@/lib/actions/types";
import { fieldError, localError, toastResult } from "@/lib/action-client";
import type { PostWithAuthor } from "@/lib/db/queries/posts";
import { t } from "@/lib/i18n";
import { memberMap, type FamilyMember } from "@/lib/members";
import { canPinPost, type Actor } from "@/lib/permissions";
import { PostCard } from "./post-card";

export function BoardView({
  posts,
  members,
  me,
  actor,
}: {
  posts: PostWithAuthor[];
  members: FamilyMember[];
  me: FamilyMember;
  actor: Actor;
}) {
  const byId = useMemo(() => memberMap(members), [members]);
  // Server already orders pinned first, newest first; keep it explicit.
  const sorted = [...posts].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div>
      <PageHeader title={t("board.title")} />
      <Composer me={me} canPin={canPinPost(actor)} />
      {sorted.length === 0 ? (
        <EmptyState icon={StickyNoteIcon} title={t("board.empty")} className="mt-6" />
      ) : (
        <ul className="mt-8 grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((p) => (
            <li key={p.id}>
              <PostCard post={p} author={p.authorId ? byId.get(p.authorId) : undefined} actor={actor} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Composer({ me, canPin }: { me: FamilyMember; canPin: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pinned, setPinned] = useState(false);
  const [state, formAction] = useActionState<ActionResult<unknown> | null, FormData>(async (_p, fd) => {
    const body = String(fd.get("body") ?? "").trim();
    if (!body) return localError("body", "Message is required");
    const res = await createPost({ body, pinned: canPin && pinned });
    if (toastResult(res, t("board.posted"))) {
      formRef.current?.reset();
      setPinned(false);
    }
    return res;
  }, null);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-2xl border bg-card p-3 focus-within:ring-[3px] focus-within:ring-ring/30"
      style={{ borderLeft: `4px solid ${me.color}` }}
    >
      <div className="flex gap-3">
        <MemberAvatar member={me} size="md" className="mt-1 max-sm:hidden" />
        <Textarea
          name="body"
          rows={3}
          maxLength={5000}
          placeholder={t("board.compose")}
          aria-label={t("board.compose")}
          aria-invalid={Boolean(fieldError(state, "body"))}
          className="min-h-20 resize-none border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) formRef.current?.requestSubmit();
          }}
        />
      </div>
      <FieldError message={fieldError(state, "body")} />
      <div className="mt-2 flex items-center justify-between gap-3">
        {canPin ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(v === true)} />
            {t("board.pinIt")}
          </label>
        ) : (
          <span />
        )}
        <SubmitButton pendingLabel={t("common.saving")}>{t("board.post")}</SubmitButton>
      </div>
    </form>
  );
}
