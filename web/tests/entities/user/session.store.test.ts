// Unit tests for entities/user/model/session.store — the Pinia session store.
//
// The store is the single source of truth for the authenticated user + tokens.
// We mock the network layer (entities/user/api/authApi) entirely so no real
// API is hit, and assert the ADR-F03 token policy:
//   - access token lives in MEMORY only (never persisted),
//   - refresh token lives in memory AND localStorage.
//
// happy-dom supplies a real `localStorage`; we read STORAGE_KEYS.refreshToken
// directly to assert persistence.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Mock the auth API module the store imports. vi.mock is hoisted; resolution is
// by module path, so this intercepts the store's `import * as authApi` too.
vi.mock('~/entities/user/api/authApi', () => ({
  register: vi.fn(),
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
  updateMe: vi.fn(),
}))

import * as authApi from '~/entities/user/api/authApi'
import { useSessionStore } from '~/entities/user'
import { STORAGE_KEYS } from '~/shared/config'
import type { AuthSession, TokenPair, User } from '~/entities/user'

const mockApi = vi.mocked(authApi)

const user: User = {
  id: 'u1',
  email: 'ruben@nalvun.com',
  displayName: 'Rubén',
  createdAt: '2026-01-01T00:00:00.000Z',
}

function session(over: Partial<AuthSession> = {}): AuthSession {
  return {
    user,
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresIn: 900,
    ...over,
  }
}

function pair(over: Partial<TokenPair> = {}): TokenPair {
  return { accessToken: 'access-2', refreshToken: 'refresh-2', ...over }
}

function persistedRefresh(): string | null {
  return localStorage.getItem(STORAGE_KEYS.refreshToken)
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------

describe('login', () => {
  it('stores the access token in memory and persists the refresh token', async () => {
    mockApi.login.mockResolvedValue(session())
    const store = useSessionStore()

    await store.login('ruben@nalvun.com', 'pw')

    expect(mockApi.login).toHaveBeenCalledWith({
      email: 'ruben@nalvun.com',
      password: 'pw',
    })
    expect(store.accessToken).toBe('access-1')
    expect(store.refreshToken).toBe('refresh-1')
    expect(store.user).toEqual(user)
    expect(store.status).toBe('authenticated')

    // ADR-F03: refresh token persisted, access token NEVER persisted.
    expect(persistedRefresh()).toBe('refresh-1')
    expect(localStorage.getItem('fs25.accessToken')).toBeNull()
  })

  it('on failure leaves the store anonymous and rethrows', async () => {
    const boom = new Error('bad creds')
    mockApi.login.mockRejectedValue(boom)
    const store = useSessionStore()

    await expect(store.login('x@y.z', 'pw')).rejects.toBe(boom)

    expect(store.accessToken).toBeNull()
    expect(store.user).toBeNull()
    expect(store.status).toBe('anonymous')
    expect(persistedRefresh()).toBeNull()
  })
})

describe('register', () => {
  it('starts a session like login (access in memory, refresh persisted)', async () => {
    mockApi.register.mockResolvedValue(
      session({ accessToken: 'a-reg', refreshToken: 'r-reg' }),
    )
    const store = useSessionStore()

    await store.register({ email: 'new@u.com', password: 'pw12345678' })

    expect(store.accessToken).toBe('a-reg')
    expect(store.user).toEqual(user)
    expect(store.status).toBe('authenticated')
    expect(persistedRefresh()).toBe('r-reg')
  })
})

describe('isAuthenticated getter', () => {
  it('is false without a user/token and true once both are set', async () => {
    const store = useSessionStore()
    expect(store.isAuthenticated).toBe(false)

    mockApi.login.mockResolvedValue(session())
    await store.login('ruben@nalvun.com', 'pw')
    expect(store.isAuthenticated).toBe(true)
  })

  it('is false when only a token (no user) is present', () => {
    const store = useSessionStore()
    store.setTokens('access-only', 'refresh-only')
    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })
})

describe('refresh', () => {
  it('rotates tokens and returns true on success', async () => {
    const store = useSessionStore()
    store.setTokens('access-1', 'refresh-1')
    mockApi.refresh.mockResolvedValue(pair())

    const okFlag = await store.refresh()

    expect(okFlag).toBe(true)
    expect(mockApi.refresh).toHaveBeenCalledWith('refresh-1')
    expect(store.accessToken).toBe('access-2')
    expect(store.refreshToken).toBe('refresh-2')
    // The rotated refresh token is re-persisted.
    expect(persistedRefresh()).toBe('refresh-2')
  })

  it('returns false and clears the session when there is no refresh token', async () => {
    const store = useSessionStore()

    const okFlag = await store.refresh()

    expect(okFlag).toBe(false)
    expect(mockApi.refresh).not.toHaveBeenCalled()
    expect(store.status).toBe('anonymous')
  })

  it('returns false and clears the session when the API rejects', async () => {
    const store = useSessionStore()
    store.user = user
    store.setTokens('access-1', 'refresh-1')
    mockApi.refresh.mockRejectedValue(new Error('reuse detected'))

    const okFlag = await store.refresh()

    expect(okFlag).toBe(false)
    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.user).toBeNull()
    expect(persistedRefresh()).toBeNull()
    expect(store.status).toBe('anonymous')
  })
})

describe('logout', () => {
  it('revokes the refresh token then clears memory + localStorage', async () => {
    mockApi.login.mockResolvedValue(session())
    mockApi.logout.mockResolvedValue(undefined)
    const store = useSessionStore()
    await store.login('ruben@nalvun.com', 'pw')
    expect(persistedRefresh()).toBe('refresh-1')

    await store.logout()

    expect(mockApi.logout).toHaveBeenCalledWith('refresh-1')
    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.user).toBeNull()
    expect(store.status).toBe('anonymous')
    expect(persistedRefresh()).toBeNull()
  })

  it('still clears local state when the revoke call fails (best-effort)', async () => {
    mockApi.login.mockResolvedValue(session())
    mockApi.logout.mockRejectedValue(new Error('network'))
    const store = useSessionStore()
    await store.login('ruben@nalvun.com', 'pw')

    await store.logout()

    expect(store.accessToken).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(persistedRefresh()).toBeNull()
  })

  it('does not call the API when there is no refresh token', async () => {
    const store = useSessionStore()
    await store.logout()
    expect(mockApi.logout).not.toHaveBeenCalled()
  })
})

describe('init (session restore)', () => {
  it('stays anonymous when no refresh token is persisted', async () => {
    const store = useSessionStore()
    await store.init()
    expect(store.status).toBe('anonymous')
    expect(mockApi.refresh).not.toHaveBeenCalled()
  })

  it('restores a session from a persisted refresh token', async () => {
    localStorage.setItem(STORAGE_KEYS.refreshToken, 'persisted-refresh')
    mockApi.refresh.mockResolvedValue(pair())
    mockApi.getMe.mockResolvedValue(user)
    const store = useSessionStore()

    await store.init()

    expect(mockApi.refresh).toHaveBeenCalledWith('persisted-refresh')
    expect(store.accessToken).toBe('access-2')
    expect(store.user).toEqual(user)
    expect(store.isAuthenticated).toBe(true)
    expect(store.status).toBe('authenticated')
  })

  it('clears everything when the persisted refresh token is invalid', async () => {
    localStorage.setItem(STORAGE_KEYS.refreshToken, 'stale')
    mockApi.refresh.mockRejectedValue(new Error('expired'))
    const store = useSessionStore()

    await store.init()

    expect(store.isAuthenticated).toBe(false)
    expect(store.status).toBe('anonymous')
    expect(persistedRefresh()).toBeNull()
    expect(mockApi.getMe).not.toHaveBeenCalled()
  })
})

describe('updateProfile / fetchMe', () => {
  it('updateProfile pushes the new user into the store', async () => {
    const updated: User = { ...user, displayName: 'Nuevo' }
    mockApi.updateMe.mockResolvedValue(updated)
    const store = useSessionStore()

    const result = await store.updateProfile({ displayName: 'Nuevo' })

    expect(result).toEqual(updated)
    expect(store.user).toEqual(updated)
  })

  it('fetchMe loads the profile into the store', async () => {
    mockApi.getMe.mockResolvedValue(user)
    const store = useSessionStore()

    const result = await store.fetchMe()

    expect(result).toEqual(user)
    expect(store.user).toEqual(user)
  })
})
