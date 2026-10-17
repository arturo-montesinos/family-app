/** Pure result types for server actions — safe to import from client components. */
export type ActionErrorCode =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "bad_request"
  | "no_household"
  | "internal";

export type ActionError = {
  code: ActionErrorCode;
  message: string;
  /** Per-field messages (zod), keyed by field name, e.g. { title: ["Title is required"] }. */
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };
