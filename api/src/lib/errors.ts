/**
 * Typed domain error system.
 *
 * Every error the application throws on purpose is an {@link AppError}. The
 * error-handler plugin (`src/plugins/error-handler.ts`) is the single place that
 * turns these into the HTTP error envelope `{ error: { code, message, details? } }`
 * defined in `docs/arquitectura-api.md` §8/§10.
 *
 * The hierarchy is intentionally generic: later stories (H4+) add new codes such
 * as `FIELD_NOT_FOUND`, `CROP_VERSION_MISMATCH`, `COUNT_EXCEEDS_CAPACITY`, etc.
 * simply by passing the right `code` to the matching subclass — no new classes
 * are required per code.
 */

/** A single validation issue, mirroring the OpenAPI `ErrorResponse.details` item. */
export interface ErrorDetail {
  /** Dot-joined path to the offending field, e.g. `"hectares"`. Optional. */
  path?: string;
  /** Human-readable description of the issue. */
  message: string;
}

/**
 * Base class for all deliberate, client-facing errors.
 *
 * `statusCode` and `code` drive the HTTP response; `details` carries optional
 * per-field validation issues. Anything that is NOT an `AppError` is treated as
 * an unexpected failure and mapped to a generic 500 by the error handler.
 */
export class AppError extends Error {
  /** Stable, uppercase machine code (e.g. `FARM_NOT_FOUND`). */
  public readonly code: string;
  /** HTTP status code to respond with. */
  public readonly statusCode: number;
  /** Optional list of validation issues. */
  public readonly details?: ErrorDetail[];

  constructor(
    code: string,
    statusCode: number,
    message: string,
    details?: ErrorDetail[],
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    // Restore prototype chain for `instanceof` after transpilation to ES2022/CJS.
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }
}

/**
 * 404 — resource not found (also used for cross-user access per ADR-005, which
 * answers 404 instead of 403 to avoid leaking existence).
 *
 * @example new NotFoundError('FARM_NOT_FOUND')
 */
export class NotFoundError extends AppError {
  constructor(code: string, message = 'Resource not found') {
    super(code, 404, message);
  }
}

/**
 * 409 — conflict with current state (e.g. `EMAIL_ALREADY_REGISTERED`,
 * `DUPLICATE_FARM_NAME`).
 */
export class ConflictError extends AppError {
  constructor(code: string, message = 'Conflict') {
    super(code, 409, message);
  }
}

/**
 * 401 — authentication failed or missing (`TOKEN_EXPIRED`,
 * `INVALID_CREDENTIALS`, `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_REUSED`,
 * `UNAUTHORIZED`).
 */
export class UnauthorizedError extends AppError {
  constructor(code = 'UNAUTHORIZED', message = 'Unauthorized') {
    super(code, 401, message);
  }
}

/**
 * 422 — schema/shape validation failure. Always carries `details`.
 *
 * Used both for zod request-validation failures (mapped by the error handler)
 * and for any explicit `VALIDATION_ERROR` thrown by services.
 */
export class ValidationError extends AppError {
  constructor(
    details: ErrorDetail[],
    message = 'Validation failed',
    code = 'VALIDATION_ERROR',
  ) {
    super(code, 422, message, details);
  }
}

/**
 * 422 — semantically unprocessable but not a plain schema error: business-rule
 * violations such as `CROP_VERSION_MISMATCH`, `COUNT_EXCEEDS_CAPACITY` or
 * `FARM_NOT_OWNED`. `details` is optional here.
 */
export class UnprocessableError extends AppError {
  constructor(code: string, message = 'Unprocessable entity', details?: ErrorDetail[]) {
    super(code, 422, message, details);
  }
}

/** 429 — too many requests against a rate-limited route. */
export class RateLimitedError extends AppError {
  constructor(
    code = 'RATE_LIMITED',
    message = 'Demasiados intentos, reintenta más tarde',
  ) {
    super(code, 429, message);
  }
}

/**
 * Type guard: is this value one of our deliberate domain errors?
 *
 * The error handler uses this to decide between formatting a known error and
 * masking an unexpected one as a generic 500.
 */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/**
 * Named constructors grouped for ergonomic call-sites:
 *
 * @example
 *   throw Errors.notFound('FARM_NOT_FOUND');
 *   throw Errors.conflict('EMAIL_ALREADY_REGISTERED', 'Email already in use');
 *   throw Errors.unauthorized('TOKEN_EXPIRED', 'Access token expired');
 *   throw Errors.validation([{ path: 'email', message: 'invalid email' }]);
 *   throw Errors.unprocessable('FARM_NOT_OWNED');
 *   throw Errors.rateLimited();
 */
export const Errors = {
  notFound: (code: string, message?: string): NotFoundError =>
    new NotFoundError(code, message),
  conflict: (code: string, message?: string): ConflictError =>
    new ConflictError(code, message),
  unauthorized: (code?: string, message?: string): UnauthorizedError =>
    new UnauthorizedError(code, message),
  validation: (
    details: ErrorDetail[],
    message?: string,
    code?: string,
  ): ValidationError => new ValidationError(details, message, code),
  unprocessable: (
    code: string,
    message?: string,
    details?: ErrorDetail[],
  ): UnprocessableError => new UnprocessableError(code, message, details),
  rateLimited: (code?: string, message?: string): RateLimitedError =>
    new RateLimitedError(code, message),
} as const;
