"use client";

import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MEMBER_COLORS, readableOn } from "@/lib/members";

type Props = {
  value: string | null;
  onChange: (color: string | null) => void;
  /** Shows a leading "automatic" swatch that maps to null. */
  allowNone?: boolean;
  noneLabel?: string;
  name?: string;
  label: string;
  disabled?: boolean;
  className?: string;
};

/** Swatch radio group. Renders a hidden input when `name` is given so it works in forms. */
export function ColorPicker({ value, onChange, allowNone, noneLabel, name, label, disabled, className }: Props) {
  const current = value?.toLowerCase() ?? null;
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {name ? <input type="hidden" name={name} value={current ?? ""} /> : null}
      {allowNone ? (
        <button
          type="button"
          role="radio"
          aria-checked={current === null}
          aria-label={noneLabel}
          title={noneLabel}
          disabled={disabled}
          onClick={() => onChange(null)}
          className={cn(
            "grid size-8 place-items-center rounded-full border-2 border-dashed border-muted-foreground/40 text-muted-foreground outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50",
            current === null && "border-solid border-foreground text-foreground",
          )}
        >
          {current === null ? <CheckIcon className="size-4" /> : null}
        </button>
      ) : null}
      {MEMBER_COLORS.map((c) => {
        const selected = current === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c}
            disabled={disabled}
            onClick={() => onChange(c)}
            className={cn(
              "grid size-8 place-items-center rounded-full outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50",
              selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
            )}
            style={{ backgroundColor: c, color: readableOn(c) }}
          >
            {selected ? <CheckIcon className="size-4" /> : null}
          </button>
        );
      })}
    </div>
  );
}
