/**
 * Typed application errors. Pure module (no server-only imports) so it can be used
 * from validators, permissions, tests and the /api/v1 wrapper alike.
 */
export class AppError extends Error {
  readonly status: number = 500;
}

export class BadRequestError extends AppError {
  override readonly status = 400;
  constructor(message = "Bad request") {
    super(message);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AppError {
  override readonly status = 401;
  constructor(message = "Not signed in") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  override readonly status = 403;
  constructor(message = "Not a member of this household") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  override readonly status = 404;
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  override readonly status = 409;
  constructor(message = "Conflict") {
    super(message);
    this.name = "ConflictError";
  }
}

export class TooManyRequestsError extends AppError {
  override readonly status = 429;
  constructor(
    message = "Too many requests",
    /** Seconds until the client may retry (sent as Retry-After). */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "TooManyRequestsError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Throws NotFoundError for ids that can't possibly exist (avoids Postgres uuid cast errors). */
export function assertUuid(value: string, what = "Resource"): void {
  if (!isUuid(value)) throw new NotFoundError(`${what} not found`);
}
