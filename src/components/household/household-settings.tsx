"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { LogOutIcon, MailPlusIcon, PencilIcon, Trash2Icon, UserMinusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorPicker } from "@/components/common/color-picker";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CopyField } from "@/components/common/copy-field";
import { FieldError } from "@/components/common/field-error";
import { MemberAvatar } from "@/components/common/member-avatar";
import { PageHeader } from "@/components/common/page-header";
import { SubmitButton } from "@/components/common/submit-button";
import { deleteHousehold, removeMember, updateHousehold, updateMember } from "@/lib/actions/households";
import { createInvite, revokeInvite } from "@/lib/actions/invites";
import type { ActionResult } from "@/lib/actions/types";
import { fieldError, toastResult } from "@/lib/action-client";
import type { MemberRole } from "@/lib/db/schema";
import { dateLocale, t, type MessageKey } from "@/lib/i18n";
import type { FamilyMember } from "@/lib/members";
import {
  canChangeRole,
  canManageHousehold,
  canManageInvites,
  canRemoveMember,
  canUpdateMemberProfile,
  type Actor,
} from "@/lib/permissions";

export type InviteRow = { id: string; email: string; role: MemberRole; expiresAt: string; url: string };

const ROLES: MemberRole[] = ["owner", "adult", "child"];
const roleLabel = (r: MemberRole) => t(`role.${r}` as MessageKey);

type Props = {
  householdId: string;
  householdName: string;
  members: FamilyMember[];
  me: FamilyMember;
  actor: Actor;
  invites: InviteRow[];
};

export function HouseholdSettings({ householdId, householdName, members, me, actor, invites }: Props) {
  const ownerCount = members.filter((m) => m.role === "owner").length;
  const isOwner = canManageHousehold(actor);

  return (
    <div className="max-w-2xl">
      <PageHeader title={t("settings.title")} />

      <Section title={t("settings.household")}>
        <RenameForm householdId={householdId} name={householdName} disabled={!isOwner} />
        {!isOwner ? <p className="mt-2 text-sm text-muted-foreground">{t("settings.ownerOnly")}</p> : null}
      </Section>

      <Section title={t("settings.members")}>
        <ul className="divide-y rounded-2xl border bg-card">
          {members.map((m) => (
            <MemberRow
              key={m.userId}
              householdId={householdId}
              member={m}
              isMe={m.userId === me.userId}
              actor={actor}
              ownerCount={ownerCount}
            />
          ))}
        </ul>
      </Section>

      {canManageInvites(actor) ? (
        <Section title={t("settings.invites")} lead={t("settings.invitesLead")}>
          <InviteForm householdId={householdId} />
          <h3 className="mt-6 mb-2 font-sans text-sm font-semibold text-muted-foreground">{t("settings.pending")}</h3>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("settings.noPending")}</p>
          ) : (
            <ul className="grid gap-3">
              {invites.map((inv) => (
                <PendingInvite key={inv.id} householdId={householdId} invite={inv} />
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      <Section title={t("settings.danger")}>
        <DangerZone
          householdId={householdId}
          householdName={householdName}
          me={me}
          ownerCount={ownerCount}
          isOwner={isOwner}
        />
      </Section>
    </div>
  );
}

function Section({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      {lead ? <p className="mt-1 text-sm text-muted-foreground">{lead}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* ---------------------------------- household ---------------------------------- */

function RenameForm({ householdId, name, disabled }: { householdId: string; name: string; disabled: boolean }) {
  const [state, action] = useActionState<ActionResult<unknown> | null, FormData>(async (_p, fd) => {
    const res = await updateHousehold(householdId, { name: String(fd.get("name") ?? "") });
    toastResult(res, t("settings.renamed"));
    return res;
  }, null);
  return (
    <form action={action} className="grid gap-2">
      <Label htmlFor="hh-rename">{t("settings.rename")}</Label>
      <div className="flex gap-2">
        <Input
          id="hh-rename"
          name="name"
          defaultValue={name}
          key={name}
          maxLength={80}
          required
          disabled={disabled}
          aria-invalid={Boolean(fieldError(state, "name"))}
          className="h-10"
        />
        {!disabled ? <SubmitButton variant="secondary">{t("common.save")}</SubmitButton> : null}
      </div>
      <FieldError message={fieldError(state, "name")} />
    </form>
  );
}

/* ----------------------------------- members ----------------------------------- */

function MemberRow({
  householdId,
  member,
  isMe,
  actor,
  ownerCount,
}: {
  householdId: string;
  member: FamilyMember;
  isMe: boolean;
  actor: Actor;
  ownerCount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [rolePending, startRole] = useTransition();
  const mayEditProfile = canUpdateMemberProfile(actor, member);
  const mayRemove = !isMe && canRemoveMember(actor, member, ownerCount);
  const roleOptions = ROLES.filter((r) => r === member.role || canChangeRole(actor, member, r, ownerCount));
  const mayChangeRole = roleOptions.length > 1;

  return (
    <li className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
      <MemberAvatar member={member} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {member.name} {isMe ? <span className="text-muted-foreground">({t("common.you")})</span> : null}
        </p>
        {member.email ? <p className="truncate text-sm text-muted-foreground">{member.email}</p> : null}
      </div>
      <div className="flex w-full items-center gap-1 sm:w-auto">
        {mayChangeRole ? (
          <Select
            value={member.role}
            disabled={rolePending}
            onValueChange={(role) =>
              startRole(async () => {
                if (toastResult(await updateMember(householdId, member.userId, { role: role as MemberRole }), t("settings.memberSaved"))) {
                  router.refresh();
                }
              })
            }
          >
            <SelectTrigger size="sm" aria-label={`${t("settings.role")}: ${member.name}`} className="mr-auto sm:mr-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((r) => (
                <SelectItem key={r} value={r}>
                  {roleLabel(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="mr-auto rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground sm:mr-0">
            {roleLabel(member.role)}
          </span>
        )}
        {mayEditProfile ? (
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label={`${t("common.edit")}: ${member.name}`}>
            <PencilIcon />
          </Button>
        ) : null}
        {mayRemove ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive"
            onClick={() => setConfirmRemove(true)}
            aria-label={`${t("settings.removeMember")}: ${member.name}`}
          >
            <UserMinusIcon />
          </Button>
        ) : null}
      </div>

      <MemberProfileDialog open={editing} onOpenChange={setEditing} householdId={householdId} member={member} />
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t("settings.removeConfirm", { name: member.name })}
        description={t("settings.removeBody")}
        confirmLabel={t("settings.removeMember")}
        onConfirm={async () => toastResult(await removeMember(householdId, member.userId), t("settings.removed", { name: member.name }))}
      />
    </li>
  );
}

function MemberProfileDialog({
  open,
  onOpenChange,
  householdId,
  member,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  member: FamilyMember;
}) {
  const [color, setColor] = useState<string | null>(member.colorIsDefault ? null : member.color);
  const [state, action] = useActionState<ActionResult<unknown> | null, FormData>(async (_p, fd) => {
    const res = await updateMember(householdId, member.userId, {
      displayName: String(fd.get("displayName") ?? "") || null,
      color,
    });
    if (toastResult(res, t("settings.memberSaved"))) onOpenChange(false);
    return res;
  }, null);
  const preview = { name: member.name, color: color ?? member.color };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={action} className="grid gap-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <MemberAvatar member={preview} size="md" />
              {member.name}
            </DialogTitle>
            <DialogDescription className="sr-only">{t("settings.displayName")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`dn-${member.userId}`}>{t("settings.displayName")}</Label>
            <Input
              id={`dn-${member.userId}`}
              name="displayName"
              defaultValue={member.displayName ?? ""}
              maxLength={60}
              aria-invalid={Boolean(fieldError(state, "displayName"))}
            />
            <FieldError message={fieldError(state, "displayName")} />
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium">{t("settings.color")}</span>
            <ColorPicker value={color} onChange={setColor} label={t("settings.color")} />
            <FieldError message={fieldError(state, "color")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <SubmitButton pendingLabel={t("common.saving")}>{t("common.save")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------- invites ----------------------------------- */

function InviteForm({ householdId }: { householdId: string }) {
  const [role, setRole] = useState<MemberRole>("adult");
  const [created, setCreated] = useState<{ email: string; url: string } | null>(null);
  const [state, action] = useActionState<ActionResult<unknown> | null, FormData>(async (_p, fd) => {
    const email = String(fd.get("email") ?? "");
    const res = await createInvite({ householdId, email, role });
    if (toastResult(res, t("settings.inviteCreated"))) setCreated({ email: res.data.email, url: res.data.url });
    return res;
  }, null);

  return (
    <div className="rounded-2xl border bg-card p-4">
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="inv-email">{t("settings.inviteEmail")}</Label>
          <Input
            id="inv-email"
            name="email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            required
            aria-invalid={Boolean(fieldError(state, "email"))}
            className="h-10"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="inv-role">{t("settings.inviteRole")}</Label>
          <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
            <SelectTrigger id="inv-role" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.filter((r) => r !== "owner").map((r) => (
                <SelectItem key={r} value={r}>
                  {roleLabel(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SubmitButton className="h-10" pendingLabel={t("common.saving")}>
          <MailPlusIcon /> {t("settings.inviteCreate")}
        </SubmitButton>
      </form>
      <FieldError message={fieldError(state, "email") ?? fieldError(state, "role")} />
      {created ? (
        <div className="mt-4 rounded-xl bg-today/20 p-3 ring-1 ring-today/50">
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-sm">{t("settings.inviteReady", { email: created.email })}</p>
            <button
              type="button"
              onClick={() => setCreated(null)}
              aria-label={t("common.close")}
              className="text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          </div>
          <CopyField value={absoluteUrl(created.url)} />
        </div>
      ) : null}
    </div>
  );
}

/** NEXT_PUBLIC_APP_URL may be unset in dev; fall back to this origin. */
function absoluteUrl(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  return typeof window === "undefined" ? url : new URL(url, window.location.origin).toString();
}

function PendingInvite({ householdId, invite }: { householdId: string; invite: InviteRow }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="rounded-2xl border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{invite.email}</p>
          <p className="text-xs text-muted-foreground">
            {roleLabel(invite.role)},{" "}
            {t("settings.expiresIn", {
              when: formatDistanceToNowStrict(new Date(invite.expiresAt), { addSuffix: true, locale: dateLocale }),
            })}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirm(true)}>
          {t("settings.revoke")}
        </Button>
      </div>
      <CopyField value={absoluteUrl(invite.url)} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`${t("settings.revoke")}: ${invite.email}?`}
        confirmLabel={t("settings.revoke")}
        onConfirm={async () => toastResult(await revokeInvite(householdId, invite.id), t("settings.revoked"))}
      />
    </li>
  );
}

/* ------------------------------------ danger ------------------------------------ */

function DangerZone({
  householdId,
  householdName,
  me,
  ownerCount,
  isOwner,
}: {
  householdId: string;
  householdName: string;
  me: FamilyMember;
  ownerCount: number;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const lastOwner = me.role === "owner" && ownerCount <= 1;

  const afterExit = () => {
    router.push("/dashboard"); // → next household, or /onboarding if none left
    router.refresh();
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-destructive/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-sm text-sm text-muted-foreground">{lastOwner ? t("settings.lastOwner") : t("settings.leaveBody")}</p>
        <Button variant="outline" onClick={() => setLeaving(true)} disabled={lastOwner}>
          <LogOutIcon /> {t("settings.leave")}
        </Button>
      </div>
      {isOwner ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <p className="max-w-sm text-sm text-muted-foreground">{t("settings.deleteConfirm", { household: householdName })}</p>
          <Button variant="destructive" onClick={() => setDeleting(true)}>
            <Trash2Icon /> {t("settings.deleteHousehold")}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={t("settings.leaveConfirm", { household: householdName })}
        description={t("settings.leaveBody")}
        confirmLabel={t("settings.leave")}
        onConfirm={async () => {
          const ok = toastResult(await removeMember(householdId, me.userId), t("settings.left", { household: householdName }));
          if (ok) afterExit();
          return ok;
        }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("settings.deleteConfirm", { household: householdName })}
        description={t("settings.deleteBody")}
        confirmLabel={t("settings.deleteHousehold")}
        requireText={householdName}
        onConfirm={async () => {
          const ok = toastResult(await deleteHousehold(householdId), t("settings.deleted"));
          if (ok) afterExit();
          return ok;
        }}
      />
    </div>
  );
}
