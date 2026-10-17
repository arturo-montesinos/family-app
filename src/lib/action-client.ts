"use client";

import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/types";

/** Shows a toast for an ActionResult and narrows it. Field errors are left to the form. */
export function toastResult<T>(
  res: ActionResult<T>,
  success?: string,
): res is { ok: true; data: T } {
  if (res.ok) {
    if (success) toast.success(success);
    return true;
  }
  // Validation errors are shown inline; only toast them if there are no field errors.
  if (res.error.code !== "validation" || !res.error.fieldErrors || Object.keys(res.error.fieldErrors).length === 0) {
    toast.error(res.error.message);
  }
  return false;
}

/** First message for a field, from a failed ActionResult (or undefined). */
export function fieldError(res: ActionResult<unknown> | null | undefined, field: string): string | undefined {
  if (!res || res.ok) return undefined;
  return res.error.fieldErrors?.[field]?.[0];
}

/** Drops empty-string values (so optional zod fields with min(1) don't fail on ""). */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

/** Builds a failed result locally (client-side validation), same shape as the server's. */
export function localError(field: string, message: string): ActionResult<never> {
  return { ok: false, error: { code: "validation", message, fieldErrors: { [field]: [message] } } };
}
