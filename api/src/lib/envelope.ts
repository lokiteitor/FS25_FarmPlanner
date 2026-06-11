/**
 * Response-envelope helpers.
 *
 * The API wraps every payload in a uniform envelope (see `docs/arquitectura-api.md`
 * §8.2):
 *   - success: `{ data, meta? }`
 *   - error:   `{ error: { code, message, details? } }`
 *
 * Route handlers can simply `return { data }` (the type provider validates it),
 * but `ok()` is provided for symmetry and for attaching `meta`. `errorBody()` is
 * used by the error-handler plugin to build error responses consistently.
 */

import type { ErrorDetail } from './errors';

/** Success envelope shape: data plus optional metadata (pagination, warnings). */
export interface OkEnvelope<TData, TMeta = unknown> {
  data: TData;
  meta?: TMeta;
}

/** Error envelope shape, matching OpenAPI `ErrorResponse`. */
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
  };
}

/**
 * Wrap a payload in the success envelope.
 *
 * @example ok(farm)
 * @example ok(farms, { pagination: { page: 1, perPage: 50, total: 123 } })
 */
export function ok<TData, TMeta = unknown>(
  data: TData,
  meta?: TMeta,
): OkEnvelope<TData, TMeta> {
  return meta === undefined ? { data } : { data, meta };
}

/**
 * Build the error envelope.
 *
 * `details` is only included when non-empty, keeping responses clean for errors
 * that have no field-level issues.
 */
export function errorBody(
  code: string,
  message: string,
  details?: ErrorDetail[],
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
    },
  };
}
