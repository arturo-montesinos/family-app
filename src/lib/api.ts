import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { apiKeyAccessError, bearerToken } from "@/lib/api-keys";
import type { User } from "@/lib/db/schema";
import { AppError, BadRequestError, ForbiddenError, TooManyRequestsError, assertUuid } from "@/lib/errors";
import { authenticateApiKey } from "@/lib/services/api-keys";
import {
  resolveByEntity,
  resolveHouseholdFor,
  type HouseholdCtx,
  type Principal,
} from "@/lib/services/context";

/**
 * Shared wrapper for /api/v1 route handlers.
 *
 * Auth: the Auth.js session cookie, or `Authorization: Bearer fam_…` (agent API key).
 * API keys act as the admin who created them, are bound to that household, and:
 *   - only reach routes that opt in with `allowApiKeys: true` (403 otherwise, any scope);
 *   - need a scope per method: GET → read, POST/PATCH → write, DELETE → delete (403);
 *   - are rate limited per key (429 + Retry-After; in-memory, per instance).
 *
 * Success → 200 (or `status`) `{ data }`. Errors → `{ error, issues? }` with:
 *   ZodError 422 (issues = zod issues) · invalid JSON 400 · UnauthorizedError 401 ·
 *   ForbiddenError 403 · NotFoundError 404 · ConflictError 409 · TooManyRequests 429 · other 500.
 */

export type ApiErrorBody = { error: string; issues?: z.core.$ZodIssue[] };
export type ApiSuccessBody<T> = { data: T };

type RouteParams = Record<string, string | string[] | undefined>;
type RouteContext = { params: Promise<RouteParams> };

export type ApiContext<B, Q> = {
  req: NextRequest;
  params: Record<string, string>;
  body: B;
  query: Q;
  user: User;
  principal: Principal;
};

export type HouseholdApiContext<B, Q> = ApiContext<B, Q> & HouseholdCtx & { householdId: string };

type Options<BS extends z.ZodType | undefined, QS extends z.ZodType | undefined> = {
  body?: BS;
  query?: QS;
  /** HTTP status on success (default 200). */
  status?: number;
  /** Let agent API keys call this route (scope checked by method). Default: sessions only. */
  allowApiKeys?: boolean;
};

type Out<S> = S extends z.ZodType ? z.output<S> : undefined;

export function apiError(status: number, error: string, issues?: z.core.$ZodIssue[]) {
  return NextResponse.json<ApiErrorBody>(issues ? { error, issues } : { error }, { status });
}

export function toErrorResponse(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof z.ZodError) return apiError(422, "Validation failed", err.issues);
  if (err instanceof TooManyRequestsError) {
    const res = apiError(err.status, err.message);
    if (err.retryAfter) res.headers.set("Retry-After", String(err.retryAfter));
    return res;
  }
  if (err instanceof AppError) return apiError(err.status, err.message);
  console.error("[api] unexpected error:", err);
  return apiError(500, "Internal server error");
}

async function readBody(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new BadRequestError("Request body must be valid JSON");
  }
}

function readQuery(req: NextRequest): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(req.nextUrl.searchParams.keys())) {
    const all = req.nextUrl.searchParams.getAll(key);
    out[key] = all.length > 1 ? all : all[0];
  }
  return out;
}

async function readParams(ctx: RouteContext | undefined): Promise<Record<string, string>> {
  const raw = (await ctx?.params) ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") out[k] = v;
  return out;
}

/**
 * Who is calling. A Bearer header always means "API key" (a bad key is 401 even when a
 * session cookie is also present); otherwise the session cookie.
 */
export async function authenticatePrincipal(
  req: Request,
  opts: { allowApiKeys?: boolean } = {},
): Promise<Principal> {
  const token = bearerToken(req.headers.get("authorization"));
  if (token === null) {
    return { kind: "session", user: await requireUser({ throwOnMissing: true }) };
  }
  const principal = await authenticateApiKey(token);
  if (principal.kind === "api_key") {
    const denied = apiKeyAccessError({
      allowApiKeys: opts.allowApiKeys,
      method: req.method,
      scopes: principal.key.scopes,
    });
    if (denied) throw new ForbiddenError(denied);
  }
  return principal;
}

async function authenticate(req: NextRequest, routeCtx: RouteContext | undefined, allowApiKeys?: boolean) {
  const params = await readParams(routeCtx);
  const principal = await authenticatePrincipal(req, { allowApiKeys });
  return { req, params, user: principal.user, principal };
}

/** Parses body/query AFTER auth + membership checks, so non-members can't probe validation. */
async function parseInput<BS extends z.ZodType | undefined, QS extends z.ZodType | undefined>(
  req: NextRequest,
  opts: Options<BS, QS>,
) {
  const body = (opts.body ? opts.body.parse(await readBody(req)) : undefined) as Out<BS>;
  const query = (opts.query ? opts.query.parse(readQuery(req)) : undefined) as Out<QS>;
  return { body, query };
}

function respond<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccessBody<T>>({ data }, { status });
}

/** Authenticated route (no household scope). */
export function withApi<T, BS extends z.ZodType | undefined = undefined, QS extends z.ZodType | undefined = undefined>(
  opts: Options<BS, QS>,
  handler: (ctx: ApiContext<Out<BS>, Out<QS>>) => Promise<T>,
) {
  return async (req: NextRequest, routeCtx: RouteContext) => {
    try {
      const base = await authenticate(req, routeCtx, opts.allowApiKeys);
      const input = await parseInput(req, opts);
      return respond(await handler({ ...base, ...input }), opts.status);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/** Route scoped by a household id path param (default `[id]`): checks membership. */
export function withHouseholdApi<
  T,
  BS extends z.ZodType | undefined = undefined,
  QS extends z.ZodType | undefined = undefined,
>(
  opts: Options<BS, QS> & { param?: string },
  handler: (ctx: HouseholdApiContext<Out<BS>, Out<QS>>) => Promise<T>,
) {
  return async (req: NextRequest, routeCtx: RouteContext) => {
    try {
      const base = await authenticate(req, routeCtx, opts.allowApiKeys);
      const householdId = base.params[opts.param ?? "id"] ?? "";
      assertUuid(householdId, "Household");
      const hh = await resolveHouseholdFor(base.principal, householdId);
      const input = await parseInput(req, opts);
      return respond(await handler({ ...base, ...input, ...hh, householdId }), opts.status);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/**
 * Route addressed by an entity id (`[id]`): finds the entity's household, then checks
 * membership. Non-members (and keys of other households) get 404 so ids don't leak.
 */
export function withEntityApi<
  T,
  BS extends z.ZodType | undefined = undefined,
  QS extends z.ZodType | undefined = undefined,
>(
  opts: Options<BS, QS> & {
    entity: string;
    findHouseholdId: (id: string) => Promise<string | null>;
    param?: string;
  },
  handler: (ctx: HouseholdApiContext<Out<BS>, Out<QS>> & { id: string }) => Promise<T>,
) {
  return async (req: NextRequest, routeCtx: RouteContext) => {
    try {
      const base = await authenticate(req, routeCtx, opts.allowApiKeys);
      const id = base.params[opts.param ?? "id"] ?? "";
      const hh = await resolveByEntity(id, opts.entity, opts.findHouseholdId, base.principal);
      const input = await parseInput(req, opts);
      return respond(await handler({ ...base, ...input, ...hh, id }), opts.status);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}
