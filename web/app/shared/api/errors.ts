// shared/api/errors — normalized API error type + parser.
//
// The backend reports errors as `{ error: { code, message, details? } }`
// (docs/openapi.yaml ErrorResponse). We normalize every non-2xx response — and
// transport/parse failures — into a single `ApiError` so callers (stores,
// features) can branch on a stable `code`/`status` instead of poking at raw
// payloads.

import type { ApiErrorDetail, ApiErrorPayload } from './types'

/** Stable error codes the client treats specially (see arquitectura-api.md §10). */
export const ERROR_CODES = {
  /** 401: access token expired -> triggers refresh + single retry. */
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  /** 401: missing/invalid auth that is NOT recoverable via refresh. */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** Client could not reach the server or parse the response. */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** Fallback when the backend did not send a recognizable error envelope. */
  UNKNOWN: 'UNKNOWN',
} as const

/**
 * Normalized error thrown by the HTTP client. Carries the backend `code`, the
 * HTTP `status`, and (for 422 VALIDATION_ERROR) the per-field `details`.
 */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: ApiErrorDetail[]

  constructor(params: {
    code: string
    message: string
    status: number
    details?: ApiErrorDetail[]
  }) {
    super(params.message)
    this.name = 'ApiError'
    this.code = params.code
    this.status = params.status
    this.details = params.details
    // Preserve prototype chain when targeting ES5-ish output.
    Object.setPrototypeOf(this, ApiError.prototype)
  }
}

/** Type guard for {@link ApiError}. */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

/** True when an unknown value looks like the backend error envelope. */
function hasErrorEnvelope(
  payload: unknown,
): payload is { error: Partial<ApiErrorPayload> } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof (payload as { error: unknown }).error === 'object' &&
    (payload as { error: unknown }).error !== null
  )
}

function normalizeDetails(value: unknown): ApiErrorDetail[] | undefined {
  if (!Array.isArray(value)) return undefined
  const details = value
    .filter(
      (item): item is { path?: unknown; message?: unknown } =>
        typeof item === 'object' && item !== null,
    )
    .map((item) => ({
      path: typeof item.path === 'string' ? item.path : undefined,
      message: typeof item.message === 'string' ? item.message : '',
    }))
  return details.length > 0 ? details : undefined
}

/**
 * Maps an HTTP status + parsed body into an {@link ApiError}.
 *
 * @param status  HTTP status code (use 0 for transport/parse failures).
 * @param payload The parsed response body (the `{ error: ... }` envelope), if any.
 */
export function normalizeError(status: number, payload: unknown): ApiError {
  if (hasErrorEnvelope(payload)) {
    const { code, message, details } = payload.error
    return new ApiError({
      code: typeof code === 'string' && code ? code : ERROR_CODES.UNKNOWN,
      message:
        typeof message === 'string' && message
          ? message
          : 'Error inesperado del servidor',
      status,
      details: normalizeDetails(details),
    })
  }

  // No recognizable envelope: distinguish transport failures (status 0) from
  // opaque server responses.
  if (status === 0) {
    return new ApiError({
      code: ERROR_CODES.NETWORK_ERROR,
      message: 'No se pudo conectar con el servidor',
      status: 0,
    })
  }

  return new ApiError({
    code: ERROR_CODES.UNKNOWN,
    message: 'Error inesperado del servidor',
    status,
  })
}
