import "server-only";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError, BadRequestError } from "@/lib/errors";
import { ACTIVE_HOUSEHOLD_COOKIE, ACTIVE_HOUSEHOLD_COOKIE_OPTIONS, getActiveHouseholdId } from "@/lib/household";
import { resolveHousehold, type HouseholdCtx } from "@/lib/services/context";

/* Note: this file has no "use server" — it's shared plumbing imported by action modules. */

import type { ActionError, ActionErrorCode, ActionResult } from "./types";
export type { ActionError, ActionErrorCode, ActionResult } from "./types";

const CODE_BY_STATUS: Record<number, ActionErrorCode> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
};

export function toActionError(err: unknown): ActionError {
  if (err instanceof z.ZodError) {
    const flat = z.flattenError(err);
    return {
      code: "validation",
      message: flat.formErrors[0] ?? err.issues[0]?.message ?? "Invalid input",
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
    };
  }
  if (err instanceof AppError) {
    return { code: CODE_BY_STATUS[err.status] ?? "internal", message: err.message };
  }
  console.error("[action] unexpected error:", err);
  return { code: "internal", message: "Something went wrong. Please try again." };
}

/** Runs an action body, converting thrown errors into `{ ok: false }`. Redirects/notFound still propagate. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    unstable_rethrow(err);
    return { ok: false, error: toActionError(err) };
  }
}

/** Array-valued form fields (repeated inputs / multi-selects). */
const ARRAY_FIELDS = new Set(["attendeeIds", "scopes"]);

/** FormData → plain object; repeated keys and known array fields become arrays. Drops `$ACTION_*` keys. */
export function formToObject(input: unknown): unknown {
  if (!(input instanceof FormData)) return input;
  const out: Record<string, unknown> = {};
  for (const key of new Set(input.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const all = input.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = ARRAY_FIELDS.has(key) || all.length > 1 ? all.filter((v) => v !== "") : all[0];
  }
  return out;
}

export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  return schema.parse(formToObject(input));
}

/** householdId from the input (object/FormData), else the active household cookie. */
export async function resolveHouseholdFromInput(input: unknown): Promise<HouseholdCtx> {
  const obj = formToObject(input);
  const explicit =
    obj && typeof obj === "object" && "householdId" in obj ? (obj as { householdId?: unknown }).householdId : undefined;
  const householdId = typeof explicit === "string" && explicit ? explicit : await getActiveHouseholdId();
  if (!householdId) throw new BadRequestError("Create or join a household first");
  return resolveHousehold(householdId);
}

export async function setActiveHouseholdCookie(householdId: string) {
  const store = await cookies();
  store.set(ACTIVE_HOUSEHOLD_COOKIE, householdId, ACTIVE_HOUSEHOLD_COOKIE_OPTIONS);
}

export async function clearActiveHouseholdCookie() {
  const store = await cookies();
  store.delete(ACTIVE_HOUSEHOLD_COOKIE);
}

/** App routes (see PLAN.md layout). */
export const ROUTES = {
  dashboard: "/dashboard",
  calendar: "/calendar",
  todos: "/todos",
  board: "/board",
  settings: "/settings/household",
  apiKeys: "/settings/api-keys",
  activity: "/settings/activity",
} as const;

export function revalidate(...paths: string[]) {
  for (const p of new Set(paths)) revalidatePath(p);
}

/** Everything under the authenticated shell (household switch, membership changes). */
export function revalidateApp() {
  revalidatePath("/", "layout");
}
