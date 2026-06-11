// shared/api/types — the backend response contract (envelope), derived from
// docs/openapi.yaml. Success responses are `{ data, meta? }`; error responses
// are `{ error: { code, message, details? } }`.

/** Pagination block (see PaginationMeta in openapi.yaml). */
export interface Pagination {
  page: number
  perPage: number
  total: number
}

/** Optional metadata returned alongside `data` on success responses. */
export interface ResponseMeta {
  pagination?: Pagination
  /** Non-fatal warnings (e.g. crops dropped on version change). */
  warnings?: string[]
}

/**
 * Success envelope: `{ data, meta? }`. The HTTP client unwraps the raw response
 * into this typed shape.
 */
export interface ApiEnvelope<T> {
  data: T
  meta?: ResponseMeta
}

/** A single field-level validation issue (`details[]` in the error envelope). */
export interface ApiErrorDetail {
  path?: string
  message: string
}

/** The `error` object inside a non-2xx response body. */
export interface ApiErrorPayload {
  code: string
  message: string
  details?: ApiErrorDetail[]
}

/** Error envelope: `{ error: { code, message, details? } }`. */
export interface ApiErrorEnvelope {
  error: ApiErrorPayload
}
