// Unit tests for shared/api/client — the core HTTP client.
//
// We mock the network layer by replacing the global `$fetch` (a Nuxt
// auto-import) with a fake that exposes `.raw()` returning `{ status, _data }`
// — exactly the two fields the client reads. No real network is hit.
//
// Coverage:
//   - Success envelope `{ data, meta }` unwrapping.
//   - ApiError normalization of `{ error: { code, message, details } }`.
//   - 401 TOKEN_EXPIRED -> single refresh + one retry with the fresh token.
//   - Concurrent 401s during a refresh share ONE refresh call (single-flight).
//   - Refresh failure -> onAuthError() + throw.
//   - A non-refreshable 401 (UNAUTHORIZED) -> onAuthError(), no retry.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  ERROR_CODES,
  get,
  getData,
  post,
  request,
  resetAuthHooks,
  setAuthHooks,
} from '~/shared/api'

// ---------------------------------------------------------------------------
// $fetch.raw mock helpers
// ---------------------------------------------------------------------------

interface RawResponse {
  status: number
  _data: unknown
}

/** A scripted `$fetch.raw` call: records args, returns the next queued reply. */
interface FetchMock {
  raw: ReturnType<typeof vi.fn>
  /** Push the response(s) that subsequent `.raw()` calls will resolve to. */
  queue: (...responses: RawResponse[]) => void
  /** All calls: [url, options]. */
  calls: Array<{ url: string; options: Record<string, unknown> }>
}

function installFetchMock(): FetchMock {
  const responses: RawResponse[] = []
  const calls: FetchMock['calls'] = []

  const raw = vi.fn(async (url: string, options: Record<string, unknown>) => {
    calls.push({ url, options })
    const next = responses.shift()
    if (!next) throw new Error(`No queued $fetch response for ${url}`)
    return next
  })

  // The client calls `$fetch.raw(...)`; only `.raw` needs to exist.
  const fetchFn = Object.assign(vi.fn(), { raw }) as unknown
  ;(globalThis as { $fetch: unknown }).$fetch = fetchFn

  return {
    raw,
    queue: (...r) => responses.push(...r),
    calls,
  }
}

function ok<T>(data: T, meta?: unknown, status = 200): RawResponse {
  return { status, _data: meta === undefined ? { data } : { data, meta } }
}

function errorBody(
  code: string,
  status: number,
  message = 'boom',
  details?: unknown,
): RawResponse {
  return { status, _data: { error: { code, message, details } } }
}

// ---------------------------------------------------------------------------

let fetchMock: FetchMock

beforeEach(() => {
  fetchMock = installFetchMock()
  resetAuthHooks()
})

afterEach(() => {
  resetAuthHooks()
})

// ---------------------------------------------------------------------------
// Envelope unwrapping
// ---------------------------------------------------------------------------

describe('envelope unwrapping', () => {
  it('unwraps { data, meta } into the typed envelope', async () => {
    fetchMock.queue(
      ok({ id: 'u1' }, { pagination: { page: 1, perPage: 20, total: 1 } }),
    )

    const res = await request<{ id: string }>('/things')

    expect(res.data).toEqual({ id: 'u1' })
    expect(res.meta).toEqual({ pagination: { page: 1, perPage: 20, total: 1 } })
  })

  it('get() returns the full envelope, getData() returns only data', async () => {
    fetchMock.queue(ok([{ id: 1 }], { warnings: ['w'] }))
    const full = await get<Array<{ id: number }>>('/items')
    expect(full).toEqual({ data: [{ id: 1 }], meta: { warnings: ['w'] } })

    fetchMock.queue(ok({ id: 7 }))
    const data = await getData<{ id: number }>('/items/7')
    expect(data).toEqual({ id: 7 })
  })

  it('post() returns just data and sends the JSON body', async () => {
    fetchMock.queue(ok({ ok: true }, undefined, 201))

    const data = await post<{ ok: boolean }>('/do', { name: 'x' })

    expect(data).toEqual({ ok: true })
    const [{ options }] = fetchMock.calls
    expect(options.method).toBe('POST')
    expect(options.body).toEqual({ name: 'x' })
  })

  it('treats 204 No Content as an empty envelope', async () => {
    fetchMock.queue({ status: 204, _data: undefined })
    const res = await request('/gone', { method: 'DELETE' })
    expect(res.data).toBeUndefined()
  })

  it('prefixes the API base and attaches the bearer token when present', async () => {
    setAuthHooks({ getAccessToken: () => 'tok-123' })
    fetchMock.queue(ok({ id: 'me' }))

    await get('/auth/me')

    const [{ url, options }] = fetchMock.calls
    expect(url).toBe('/api/v1/auth/me')
    const headers = options.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok-123')
  })

  it('omits the Authorization header when auth:false', async () => {
    setAuthHooks({ getAccessToken: () => 'tok-123' })
    fetchMock.queue(ok({ ok: true }))

    await request('/auth/login', { method: 'POST', body: {}, auth: false })

    const headers = fetchMock.calls[0]!.options.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Error normalization
// ---------------------------------------------------------------------------

describe('ApiError normalization', () => {
  it('normalizes { error: { code, message, details } } into ApiError', async () => {
    fetchMock.queue(
      errorBody('VALIDATION_ERROR', 422, 'Datos inválidos', [
        { path: 'email', message: 'Email requerido' },
        { path: 'password', message: 'Mínimo 8' },
      ]),
    )

    const err = await request('/auth/register', {
      method: 'POST',
      body: {},
      auth: false,
    }).catch((e) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.status).toBe(422)
    expect(err.message).toBe('Datos inválidos')
    expect(err.details).toEqual([
      { path: 'email', message: 'Email requerido' },
      { path: 'password', message: 'Mínimo 8' },
    ])
  })

  it('falls back to UNKNOWN when the body is not an error envelope', async () => {
    fetchMock.queue({ status: 500, _data: '<html>oops</html>' })

    const err = await request('/x').catch((e) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe(ERROR_CODES.UNKNOWN)
    expect(err.status).toBe(500)
  })

  it('maps a transport failure to NETWORK_ERROR (status 0)', async () => {
    fetchMock.raw.mockImplementationOnce(async () => {
      throw new TypeError('Failed to fetch')
    })

    const err = await request('/x').catch((e) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe(ERROR_CODES.NETWORK_ERROR)
    expect(err.status).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 401 TOKEN_EXPIRED -> refresh + retry
// ---------------------------------------------------------------------------

describe('401 TOKEN_EXPIRED refresh-and-retry', () => {
  it('refreshes once and retries the original request with the new token', async () => {
    // Token rotates after refresh; the retry must carry the fresh value.
    let token = 'old'
    const refresh = vi.fn(async () => {
      token = 'new'
      return true
    })
    setAuthHooks({ getAccessToken: () => token, refresh })

    // 1st call: 401 TOKEN_EXPIRED. 2nd (retry): success.
    fetchMock.queue(
      errorBody(ERROR_CODES.TOKEN_EXPIRED, 401, 'expirado'),
      ok({ id: 'me' }),
    )

    const res = await getData<{ id: string }>('/auth/me')

    expect(res).toEqual({ id: 'me' })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetchMock.calls).toHaveLength(2)
    // Retry used the rotated token.
    const retryHeaders = fetchMock.calls[1]!.options.headers as Record<string, string>
    expect(retryHeaders.Authorization).toBe('Bearer new')
  })

  it('retries at most once (a second TOKEN_EXPIRED is thrown, no infinite loop)', async () => {
    const refresh = vi.fn(async () => true)
    const onAuthError = vi.fn()
    setAuthHooks({ getAccessToken: () => 'tok', refresh, onAuthError })

    // Both the original and the single retry return 401 TOKEN_EXPIRED.
    fetchMock.queue(
      errorBody(ERROR_CODES.TOKEN_EXPIRED, 401),
      errorBody(ERROR_CODES.TOKEN_EXPIRED, 401),
    )

    const err = await getData('/auth/me').catch((e) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe(ERROR_CODES.TOKEN_EXPIRED)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetchMock.calls).toHaveLength(2)
  })

  it('calls onAuthError and throws when the refresh fails', async () => {
    const refresh = vi.fn(async () => false)
    const onAuthError = vi.fn()
    setAuthHooks({ getAccessToken: () => 'tok', refresh, onAuthError })

    fetchMock.queue(errorBody(ERROR_CODES.TOKEN_EXPIRED, 401, 'expirado'))

    const err = await getData('/auth/me').catch((e) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe(ERROR_CODES.TOKEN_EXPIRED)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(onAuthError).toHaveBeenCalledTimes(1)
    // No retry was attempted (only the original call).
    expect(fetchMock.calls).toHaveLength(1)
  })

  it('a rejecting refresh hook is treated as failure (no throw escapes)', async () => {
    const refresh = vi.fn(async () => {
      throw new Error('refresh blew up')
    })
    const onAuthError = vi.fn()
    setAuthHooks({ getAccessToken: () => 'tok', refresh, onAuthError })

    fetchMock.queue(errorBody(ERROR_CODES.TOKEN_EXPIRED, 401))

    const err = await getData('/auth/me').catch((e) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(onAuthError).toHaveBeenCalledTimes(1)
  })

  it('a non-refreshable 401 (UNAUTHORIZED) calls onAuthError without refreshing', async () => {
    const refresh = vi.fn(async () => true)
    const onAuthError = vi.fn()
    setAuthHooks({ getAccessToken: () => 'tok', refresh, onAuthError })

    fetchMock.queue(errorBody(ERROR_CODES.UNAUTHORIZED, 401, 'no auth'))

    const err = await getData('/auth/me').catch((e) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe(ERROR_CODES.UNAUTHORIZED)
    expect(refresh).not.toHaveBeenCalled()
    expect(onAuthError).toHaveBeenCalledTimes(1)
    expect(fetchMock.calls).toHaveLength(1)
  })

  it('does NOT refresh on a 401 for an auth:false request', async () => {
    const refresh = vi.fn(async () => true)
    const onAuthError = vi.fn()
    setAuthHooks({ getAccessToken: () => 'tok', refresh, onAuthError })

    fetchMock.queue(errorBody(ERROR_CODES.TOKEN_EXPIRED, 401))

    await request('/auth/login', { method: 'POST', body: {}, auth: false }).catch(
      (e) => e,
    )

    expect(refresh).not.toHaveBeenCalled()
    expect(onAuthError).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Single-flight refresh
// ---------------------------------------------------------------------------

describe('single-flight refresh', () => {
  it('concurrent 401s share ONE refresh call, then each retries', async () => {
    let resolveRefresh!: (v: boolean) => void
    const refresh = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRefresh = resolve
        }),
    )
    setAuthHooks({ getAccessToken: () => 'tok', refresh })

    // Three concurrent requests each get a 401 first, then a success on retry.
    fetchMock.queue(
      errorBody(ERROR_CODES.TOKEN_EXPIRED, 401),
      errorBody(ERROR_CODES.TOKEN_EXPIRED, 401),
      errorBody(ERROR_CODES.TOKEN_EXPIRED, 401),
      ok({ n: 1 }),
      ok({ n: 2 }),
      ok({ n: 3 }),
    )

    const p1 = getData<{ n: number }>('/a')
    const p2 = getData<{ n: number }>('/b')
    const p3 = getData<{ n: number }>('/c')

    // Let the three initial 401s land and queue up on the in-flight refresh.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(refresh).toHaveBeenCalledTimes(1)

    resolveRefresh(true)
    const results = await Promise.all([p1, p2, p3])

    // Still exactly one refresh shared by all three callers.
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(results.map((r) => r.n).sort()).toEqual([1, 2, 3])
    // 3 initial + 3 retries.
    expect(fetchMock.calls).toHaveLength(6)
  })

  it('a fresh refresh can run after a previous one settles (latch resets)', async () => {
    const refresh = vi.fn(async () => true)
    setAuthHooks({ getAccessToken: () => 'tok', refresh })

    fetchMock.queue(errorBody(ERROR_CODES.TOKEN_EXPIRED, 401), ok({ a: 1 }))
    await getData('/first')
    expect(refresh).toHaveBeenCalledTimes(1)

    fetchMock.queue(errorBody(ERROR_CODES.TOKEN_EXPIRED, 401), ok({ b: 2 }))
    await getData('/second')
    // Second 401 (after the first refresh settled) triggers a new refresh.
    expect(refresh).toHaveBeenCalledTimes(2)
  })
})
