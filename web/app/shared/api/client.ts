// shared/api/client — the core HTTP client built on ofetch ($fetch).
//
// Responsibilities (docs/arquitectura-frontend.md §5.2, §8, §10):
//   - Prefix every path with the API base.
//   - Attach `Authorization: Bearer <access token>` when available.
//   - Send/parse JSON and unwrap the success envelope into `{ data, meta }`.
//   - Normalize non-2xx bodies into `ApiError`.
//   - On `401 TOKEN_EXPIRED`: run a SINGLE-FLIGHT refresh (concurrent callers
//     await the same promise), then retry the original request ONCE with the
//     fresh token. If refresh fails -> `onAuthError()` + throw.
//
// FSD discipline: `shared` must NOT import `entities`. The auth concerns
// (where the access token lives, how to refresh, what "logout" means) are
// injected by `entities/user` at runtime via `setAuthHooks`.

import { ApiError, ERROR_CODES, isApiError, normalizeError } from './errors'
import type { ApiEnvelope } from './types'
import { getApiBase } from '~/shared/config'

/** Hooks supplied by `entities/user` so `shared` stays domain-free. */
export interface AuthHooks {
  /** Current access token, or null when unauthenticated. */
  getAccessToken: () => string | null
  /** Attempt a token refresh; resolves true on success, false on failure. */
  refresh: () => Promise<boolean>
  /** Called when auth is irrecoverable (refresh failed / no session). */
  onAuthError: () => void
}

const noopAuthHooks: AuthHooks = {
  getAccessToken: () => null,
  refresh: async () => false,
  onAuthError: () => {},
}

let authHooks: AuthHooks = noopAuthHooks

/**
 * Register the auth integration. Call once from `entities/user` (e.g. a Nuxt
 * plugin) before any authenticated request runs. Partial hooks are merged over
 * the no-op defaults.
 */
export function setAuthHooks(hooks: Partial<AuthHooks>): void {
  authHooks = { ...noopAuthHooks, ...hooks }
}

/** Reset to no-op hooks (useful in tests). */
export function resetAuthHooks(): void {
  authHooks = noopAuthHooks
}

// Single-flight refresh: while a refresh is in progress, concurrent 401s await
// the SAME promise instead of each firing their own /auth/refresh.
let refreshInFlight: Promise<boolean> | null = null

function runSingleFlightRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = Promise.resolve()
      .then(() => authHooks.refresh())
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

/** HTTP methods the client supports. */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

/** Options accepted by {@link request}. */
export interface RequestOptions {
  method?: HttpMethod
  /** JSON body; serialized automatically. */
  body?: unknown
  /** Query parameters appended to the URL. */
  query?: Record<string, string | number | boolean | undefined | null>
  /** Extra headers (merged after the defaults). */
  headers?: Record<string, string>
  /** Skip attaching the Authorization header (e.g. /auth/login, /auth/refresh). */
  auth?: boolean
  /** AbortSignal for cancellation. */
  signal?: AbortSignal
}

function joinPath(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}

function buildHeaders(opts: RequestOptions, withAuth: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...opts.headers,
  }
  // Only set Content-Type when we actually send a body.
  if (opts.body !== undefined && opts.body !== null) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
  }
  if (withAuth) {
    const token = authHooks.getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  return headers
}

interface RawResult {
  status: number
  body: unknown
}

/**
 * Perform one HTTP round-trip without throwing on non-2xx. We use
 * `$fetch.raw` + `ignoreResponseError` so envelope parsing and error handling
 * are fully under our control (rather than ofetch's FetchError).
 */
async function rawFetch(url: string, opts: RequestOptions, withAuth: boolean): Promise<RawResult> {
  try {
    const res = await $fetch.raw(url, {
      method: opts.method ?? 'GET',
      headers: buildHeaders(opts, withAuth),
      // ofetch serializes plain objects to JSON automatically.
      body: opts.body as Record<string, unknown> | undefined,
      query: opts.query,
      signal: opts.signal,
      responseType: 'json',
      ignoreResponseError: true,
    })
    return { status: res.status, body: res._data }
  } catch (err) {
    // Reaching here means a transport-level failure (DNS/offline/abort), not an
    // HTTP error status — those are captured above thanks to ignoreResponseError.
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw normalizeError(0, undefined)
  }
}

/**
 * Core request: returns the unwrapped `{ data, meta }` envelope.
 *
 * Handles the `401 TOKEN_EXPIRED` refresh-and-retry-once flow. `_retried`
 * guards against infinite loops (one retry maximum).
 */
export async function request<T>(
  path: string,
  opts: RequestOptions = {},
  _retried = false,
): Promise<ApiEnvelope<T>> {
  const withAuth = opts.auth !== false
  const url = joinPath(getApiBase(), path)

  const { status, body } = await rawFetch(url, opts, withAuth)

  // Success: 2xx. 204 (No Content) yields an empty envelope.
  if (status >= 200 && status < 300) {
    if (status === 204 || body === undefined || body === null) {
      return { data: undefined as T }
    }
    const envelope = body as ApiEnvelope<T>
    return { data: envelope?.data as T, meta: envelope?.meta }
  }

  const apiError = normalizeError(status, body)

  // 401 TOKEN_EXPIRED -> single-flight refresh + one retry.
  if (
    withAuth &&
    !_retried &&
    status === 401 &&
    apiError.code === ERROR_CODES.TOKEN_EXPIRED
  ) {
    const refreshed = await runSingleFlightRefresh()
    if (refreshed) {
      // Retry once with the (now refreshed) access token.
      return request<T>(path, opts, true)
    }
    // Refresh failed: irrecoverable.
    authHooks.onAuthError()
    throw apiError
  }

  // Any other 401 (e.g. UNAUTHORIZED): not refreshable -> signal auth error.
  if (status === 401 && withAuth) {
    authHooks.onAuthError()
  }

  throw apiError
}

/** Convenience wrapper returning just `data` (drops `meta`). */
export async function requestData<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { data } = await request<T>(path, opts)
  return data
}

// --- Typed verb helpers ------------------------------------------------------
// `get` returns the full envelope (callers often need `meta.pagination`).
// `post/patch/put/del` return just `data` by default (most mutations ignore meta),
// with a `*Full` variant when meta is needed.

type VerbOptions = Omit<RequestOptions, 'method' | 'body'>

export function get<T>(path: string, opts: VerbOptions = {}): Promise<ApiEnvelope<T>> {
  return request<T>(path, { ...opts, method: 'GET' })
}

export function getData<T>(path: string, opts: VerbOptions = {}): Promise<T> {
  return requestData<T>(path, { ...opts, method: 'GET' })
}

export function post<T>(path: string, body?: unknown, opts: VerbOptions = {}): Promise<T> {
  return requestData<T>(path, { ...opts, method: 'POST', body })
}

export function postFull<T>(path: string, body?: unknown, opts: VerbOptions = {}): Promise<ApiEnvelope<T>> {
  return request<T>(path, { ...opts, method: 'POST', body })
}

export function patch<T>(path: string, body?: unknown, opts: VerbOptions = {}): Promise<T> {
  return requestData<T>(path, { ...opts, method: 'PATCH', body })
}

export function put<T>(path: string, body?: unknown, opts: VerbOptions = {}): Promise<T> {
  return requestData<T>(path, { ...opts, method: 'PUT', body })
}

export function del<T = void>(path: string, opts: VerbOptions = {}): Promise<T> {
  return requestData<T>(path, { ...opts, method: 'DELETE' })
}

// Re-export for ergonomic single-import sites.
export { ApiError, isApiError }
