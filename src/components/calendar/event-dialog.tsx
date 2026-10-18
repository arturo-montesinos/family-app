"use client";

import { useActionState, useState } from "react";
import { ClockIcon, MapPinIcon, RepeatIcon, Trash2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ColorPicker } from "@/components/common/color-picker";
import { AddedViaAgent } from "@/components/common/agent-names";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FieldError } from "@/components/common/field-error";
import { AvatarStack, MemberAvatar } from "@/components/common/member-avatar";
import { SubmitButton } from "@/components/common/submit-button";
import { createEvent, deleteEvent, updateEvent } from "@/lib/actions/events";
import type { ActionResult } from "@/lib/actions/types";
import type { EventOccurrence } from "@/lib/db/queries/events";
import { fieldError, localError, toastResult } from "@/lib/action-client";
import {
  allDayToForm,
  dayKey,
  DEFAULT_TZ,
  formatDate,
  formatOccurrenceTime,
  nextDayKey,
  timeKey,
  zonedInstant,
} from "@/lib/dates";
import { t, type MessageKey } from "@/lib/i18n";
import { eventColor, memberMap, type FamilyMember } from "@/lib/members";
import { canDelete, canEdit, type Actor } from "@/lib/permissions";
import {
  presetToRRule,
  RECURRENCE_PRESETS,
  rruleToPreset,
  type RecurrencePreset,
} from "@/lib/recurrence-presets";
import { cn } from "@/lib/utils";

export type EventDialogTarget =
  | { mode: "create"; date: string; time?: string }
  | { mode: "edit"; occurrence: EventOccurrence };

type Props = {
  target: EventDialogTarget | null;
  onClose: () => void;
  members: FamilyMember[];
  me: FamilyMember;
  actor: Actor;
  tz?: string;
};

type FormState = {
  title: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  description: string;
  attendeeIds: string[];
  recurrence: RecurrencePreset | "custom";
  color: string | null;
};

function addHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const nh = Math.min(23, h + 1);
  return `${String(nh).padStart(2, "0")}:${String(nh === h ? 59 : m).padStart(2, "0")}`;
}

function initialState(target: EventDialogTarget, me: FamilyMember, tz: string): FormState {
  if (target.mode === "create") {
    const startTime = target.time ?? "09:00";
    return {
      title: "",
      allDay: false,
      startDate: target.date,
      startTime,
      endDate: target.date,
      endTime: addHour(startTime),
      location: "",
      description: "",
      attendeeIds: [me.userId],
      recurrence: "none",
      color: null,
    };
  }
  // Editing edits the series: show the base event's own times, not this occurrence's.
  const ev = target.occurrence;
  const starts = new Date(ev.startsAt);
  const ends = ev.endsAt ? new Date(ev.endsAt) : null;
  const allDayDates = ev.allDay ? allDayToForm(starts, ends) : null;
  return {
    title: ev.title,
    allDay: ev.allDay,
    startDate: allDayDates?.startDate ?? dayKey(starts, tz),
    startTime: ev.allDay ? "09:00" : timeKey(starts, tz),
    endDate: allDayDates?.endDate ?? dayKey(ends ?? starts, tz),
    endTime: ev.allDay ? "10:00" : timeKey(ends ?? starts, tz),
    location: ev.location ?? "",
    description: ev.description ?? "",
    attendeeIds: ev.attendeeIds,
    recurrence: rruleToPreset(ev.rrule),
    color: ev.color,
  };
}

/** Create / edit / view an event. Read-only for members who can't edit it. */
export function EventDialog({ target, onClose, members, me, actor, tz = DEFAULT_TZ }: Props) {
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {target ? (
          <EventDialogBody
            key={target.mode === "edit" ? target.occurrence.occurrenceKey : `new:${target.date}:${target.time}`}
            target={target}
            onClose={onClose}
            members={members}
            me={me}
            actor={actor}
            tz={tz}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EventDialogBody({ target, onClose, members, me, actor, tz }: Props & { target: EventDialogTarget; tz: string }) {
  const editing = target.mode === "edit" ? target.occurrence : null;
  const editable = !editing || canEdit(actor, editing);
  if (editing && !editable) return <EventReadOnly occurrence={editing} members={members} tz={tz} />;
  return <EventForm target={target} onClose={onClose} members={members} me={me} actor={actor} tz={tz} />;
}

function EventForm({ target, onClose, members, me, actor, tz }: Props & { target: EventDialogTarget; tz: string }) {
  const editing = target.mode === "edit" ? target.occurrence : null;
  const [f, setF] = useState<FormState>(() => initialState(target, me, tz));
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Every change also keeps the end on/after the start as the user moves the start around.
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((prev) => {
      const s = { ...prev, [k]: v };
      if (k === "startDate" || k === "startTime" || k === "allDay") {
        if (s.endDate < s.startDate) s.endDate = s.startDate;
        if (!s.allDay && s.endDate === s.startDate && s.endTime <= s.startTime) s.endTime = addHour(s.startTime);
      }
      return s;
    });

  const [state, formAction] = useActionState<ActionResult<unknown> | null, FormData>(async () => {
    if (!f.title.trim()) return localError("title", "Title is required");
    let startsAt: string;
    let endsAt: string | null;
    if (f.allDay) {
      startsAt = f.startDate; // "yyyy-MM-dd" → UTC midnight on the server
      endsAt = nextDayKey(f.endDate); // exclusive
    } else {
      const s = zonedInstant(f.startDate, f.startTime, tz);
      const e = zonedInstant(f.endDate, f.endTime, tz);
      if (!s) return localError("startsAt", "Pick a start date and time");
      if (!e) return localError("endsAt", "Pick an end date and time");
      if (e.getTime() < s.getTime()) return localError("endsAt", "End must be after start");
      startsAt = s.toISOString();
      endsAt = e.toISOString();
    }
    const payload = {
      title: f.title,
      allDay: f.allDay,
      startsAt,
      endsAt,
      location: f.location || null,
      description: f.description || null,
      attendeeIds: f.attendeeIds,
      color: f.color,
      // A rule we can't represent in the select is left untouched.
      ...(f.recurrence === "custom" ? {} : { rrule: presetToRRule(f.recurrence) }),
    };
    const res = editing ? await updateEvent(editing.eventId, payload) : await createEvent(payload);
    if (toastResult(res, editing ? t("event.updated") : t("event.created"))) onClose();
    return res;
  }, null);

  const err = (k: string) => fieldError(state, k);
  const isSeries = Boolean(editing?.rrule);

  return (
    <form action={formAction} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{editing ? t("event.editTitle") : t("event.newTitle")}</DialogTitle>
        {isSeries && editing ? (
          <DialogDescription>
            {t("event.seriesNote", { date: formatDate(new Date(editing.startsAt), editing.allDay, tz, "MMM d, yyyy") })}
          </DialogDescription>
        ) : (
          <DialogDescription className="sr-only">{t("event.title")}</DialogDescription>
        )}
        {editing ? <AddedViaAgent keyId={editing.createdViaApiKeyId} /> : null}
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="ev-title">{t("event.title")}</Label>
        <Input
          id="ev-title"
          value={f.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder={t("event.titlePlaceholder")}
          maxLength={200}
          autoFocus={!editing}
          aria-invalid={Boolean(err("title"))}
          className="h-11 text-base"
        />
        <FieldError message={err("title")} />
      </div>

      <fieldset className="grid gap-3">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-medium">{t("event.start")}</legend>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={f.allDay} onCheckedChange={(v) => set("allDay", v === true)} />
            {t("event.allDay")}
          </label>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input
            type="date"
            aria-label={`${t("event.start")} ${t("event.date")}`}
            value={f.startDate}
            onChange={(e) => e.target.value && set("startDate", e.target.value)}
            required
            className="h-11"
          />
          {!f.allDay ? (
            <Input
              type="time"
              aria-label={`${t("event.start")} ${t("event.time")}`}
              value={f.startTime}
              onChange={(e) => e.target.value && set("startTime", e.target.value)}
              required
              className="h-11 w-32"
            />
          ) : null}
        </div>
        <FieldError message={err("startsAt")} />
        <span className="text-sm font-medium">{t("event.end")}</span>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input
            type="date"
            aria-label={`${t("event.end")} ${t("event.date")}`}
            value={f.endDate}
            min={f.startDate}
            onChange={(e) => e.target.value && set("endDate", e.target.value)}
            required
            aria-invalid={Boolean(err("endsAt"))}
            className="h-11"
          />
          {!f.allDay ? (
            <Input
              type="time"
              aria-label={`${t("event.end")} ${t("event.time")}`}
              value={f.endTime}
              onChange={(e) => e.target.value && set("endTime", e.target.value)}
              required
              aria-invalid={Boolean(err("endsAt"))}
              className="h-11 w-32"
            />
          ) : null}
        </div>
        <FieldError message={err("endsAt")} />
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="ev-repeat">{t("event.recurrence")}</Label>
        <Select value={f.recurrence} onValueChange={(v) => set("recurrence", v as FormState["recurrence"])}>
          <SelectTrigger id="ev-repeat" className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECURRENCE_PRESETS.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`event.recurrence.${p}` as MessageKey)}
              </SelectItem>
            ))}
            {f.recurrence === "custom" ? <SelectItem value="custom">{t("event.recurrence.custom")}</SelectItem> : null}
          </SelectContent>
        </Select>
        <FieldError message={err("rrule")} />
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t("event.attendees")}</legend>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const checked = f.attendeeIds.includes(m.userId);
            return (
              <label
                key={m.userId}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                  checked ? "border-transparent bg-secondary font-medium" : "text-muted-foreground",
                )}
                style={checked ? { boxShadow: `inset 0 0 0 2px ${m.color}` } : undefined}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={(e) =>
                    set(
                      "attendeeIds",
                      e.target.checked ? [...f.attendeeIds, m.userId] : f.attendeeIds.filter((id) => id !== m.userId),
                    )
                  }
                />
                <MemberAvatar member={m} size="sm" />
                {m.name}
                {m.userId === me.userId ? <span className="text-muted-foreground">({t("common.you")})</span> : null}
              </label>
            );
          })}
        </div>
        <FieldError message={err("attendeeIds")} />
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="ev-location">
          {t("event.location")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
        </Label>
        <Input
          id="ev-location"
          value={f.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder={t("event.locationPlaceholder")}
          maxLength={300}
          className="h-11"
        />
        <FieldError message={err("location")} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="ev-notes">
          {t("event.description")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
        </Label>
        <Textarea
          id="ev-notes"
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          maxLength={5000}
        />
        <FieldError message={err("description")} />
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-medium">{t("event.color")}</span>
        <ColorPicker
          value={f.color}
          onChange={(c) => set("color", c)}
          allowNone
          noneLabel={t("event.colorAuto")}
          label={t("event.color")}
        />
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        {editing && canDelete(actor, editing) ? (
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
          <SubmitButton pendingLabel={t("common.saving")}>{editing ? t("common.save") : t("event.create")}</SubmitButton>
        </div>
      </DialogFooter>

      {editing ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={isSeries ? t("event.deleteSeriesConfirm") : t("event.deleteConfirm")}
          description={editing.title}
          confirmLabel={t("common.delete")}
          onConfirm={async () => {
            const res = await deleteEvent(editing.eventId);
            if (toastResult(res, t("event.deleted"))) onClose();
            return res.ok;
          }}
        />
      ) : null}
    </form>
  );
}

function EventReadOnly({ occurrence, members, tz }: { occurrence: EventOccurrence; members: FamilyMember[]; tz: string }) {
  const byId = memberMap(members);
  const attendees = occurrence.attendeeIds.map((id) => byId.get(id)).filter((m): m is FamilyMember => !!m);
  const color = eventColor(occurrence, byId);
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <div className="flex items-start gap-3">
          <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          <DialogTitle className="text-xl">{occurrence.title}</DialogTitle>
        </div>
        <DialogDescription className="sr-only">{t("event.viewTitle")}</DialogDescription>
        <AddedViaAgent keyId={occurrence.createdViaApiKeyId} />
      </DialogHeader>
      <ul className="grid gap-2 text-sm">
        <li className="flex items-center gap-2">
          <ClockIcon className="size-4 text-muted-foreground" aria-hidden />
          {formatDate(new Date(occurrence.occurrenceStart), occurrence.allDay, tz)} ·{" "}
          {formatOccurrenceTime(occurrence, tz, t("cal.allDay"))}
        </li>
        {occurrence.rrule ? (
          <li className="flex items-center gap-2">
            <RepeatIcon className="size-4 text-muted-foreground" aria-hidden />
            {t(`event.recurrence.${rruleToPreset(occurrence.rrule)}` as MessageKey)}
          </li>
        ) : null}
        {occurrence.location ? (
          <li className="flex items-center gap-2">
            <MapPinIcon className="size-4 text-muted-foreground" aria-hidden />
            {occurrence.location}
          </li>
        ) : null}
      </ul>
      {attendees.length ? (
        <div className="flex items-center gap-2 text-sm">
          <AvatarStack members={attendees} max={6} />
          <span className="text-muted-foreground">{attendees.map((a) => a.name).join(", ")}</span>
        </div>
      ) : null}
      {occurrence.description ? <p className="text-sm whitespace-pre-wrap">{occurrence.description}</p> : null}
      <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">{t("event.readOnly")}</p>
    </div>
  );
}
