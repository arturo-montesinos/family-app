"use client";

import { useState, useTransition } from "react";
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
import { t } from "@/lib/i18n";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  /** Return true (or nothing) to close; false keeps the dialog open. */
  onConfirm: () => Promise<boolean | void>;
  /** When set, the user must type this exact text to enable the button. */
  requireText?: string;
  destructive?: boolean;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  requireText,
  destructive = true,
}: Props) {
  const [pending, start] = useTransition();
  const [typed, setTyped] = useState("");
  const blocked = requireText !== undefined && typed.trim() !== requireText.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {requireText !== undefined ? (
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={requireText}
            aria-label={requireText}
            autoFocus
          />
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending || blocked}
            onClick={() =>
              start(async () => {
                const keepOpen = (await onConfirm()) === false;
                if (!keepOpen) {
                  setTyped("");
                  onOpenChange(false);
                }
              })
            }
          >
            {pending ? t("common.saving") : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
