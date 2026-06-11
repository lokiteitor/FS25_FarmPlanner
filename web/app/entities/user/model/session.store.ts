// entities/user/model/session.store — the Pinia 'session' store: single source
// of truth for the authenticated user and auth tokens.
//
// Token policy (ADR-F03): the access token lives ONLY in memory (this store);
// the refresh token is also kept in memory AND persisted to localStorage so the
// session survives a reload. We persist the refresh token ourselves (not via a
// persistence plugin) to keep the rule explicit and avoid leaking the access
// token to storage.
//
// FSD: this slice depends on `shared` (api + config) only. The HTTP client's
// auth hooks are wired from the app layer (app/app/providers/auth.client.ts),
// which calls `accessToken` / `refresh()` / `clear()` here.

import { defineStore } from 'pinia'
import * as authApi from '../api/authApi'
import type {
  RegisterRequest,
  SessionStatus,
  UpdateProfileRequest,
  User,
} from './types'
import { STORAGE_KEYS } from '~/shared/config'
import { isApiError } from '~/shared/api'

interface SessionState {
  user: User | null
  /** Access token — kept in memory only (ADR-F03). Never persisted. */
  accessToken: string | null
  /** Refresh token — in memory + localStorage. */
  refreshToken: string | null
  status: SessionStatus
}

/** Read the persisted refresh token (client-only; guards SSR/test contexts). */
function readPersistedRefreshToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(STORAGE_KEYS.refreshToken)
}

/** Persist (or clear) the refresh token in localStorage. */
function writePersistedRefreshToken(token: string | null): void {
  if (typeof localStorage === 'undefined') return
  if (token) localStorage.setItem(STORAGE_KEYS.refreshToken, token)
  else localStorage.removeItem(STORAGE_KEYS.refreshToken)
}

export const useSessionStore = defineStore('session', {
  state: (): SessionState => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    status: 'idle',
  }),

  getters: {
    /** True once we hold a user + access token. */
    isAuthenticated: (state): boolean => state.user !== null && state.accessToken !== null,
  },

  actions: {
    /**
     * Store a fresh token pair: access in memory, refresh in memory +
     * localStorage. Centralizes the ADR-F03 split so every flow uses it.
     */
    setTokens(accessToken: string, refreshToken: string): void {
      this.accessToken = accessToken
      this.refreshToken = refreshToken
      writePersistedRefreshToken(refreshToken)
    },

    /** Wipe the session (memory + persisted refresh token). */
    clear(): void {
      this.user = null
      this.accessToken = null
      this.refreshToken = null
      writePersistedRefreshToken(null)
      this.status = 'anonymous'
    },

    /**
     * Restore a session on app start. Reads the persisted refresh token; if
     * present, rotates it (refresh) and loads the profile. Any failure leaves
     * the user anonymous. Safe to call once from the app-layer plugin.
     */
    async init(): Promise<void> {
      this.status = 'loading'
      const persisted = readPersistedRefreshToken()
      if (!persisted) {
        this.status = 'anonymous'
        return
      }
      this.refreshToken = persisted
      const refreshed = await this.refresh()
      if (!refreshed) {
        // refresh() already cleared the session on failure.
        return
      }
      try {
        await this.fetchMe()
        this.status = 'authenticated'
      } catch {
        this.clear()
      }
    },

    /** Log in with credentials and start an authenticated session. */
    async login(email: string, password: string): Promise<void> {
      this.status = 'loading'
      try {
        const session = await authApi.login({ email, password })
        this.setTokens(session.accessToken, session.refreshToken)
        this.user = session.user
        this.status = 'authenticated'
      } catch (err) {
        this.status = 'anonymous'
        throw err
      }
    },

    /** Register a new account and start an authenticated session. */
    async register(body: RegisterRequest): Promise<void> {
      this.status = 'loading'
      try {
        const session = await authApi.register(body)
        this.setTokens(session.accessToken, session.refreshToken)
        this.user = session.user
        this.status = 'authenticated'
      } catch (err) {
        this.status = 'anonymous'
        throw err
      }
    },

    /**
     * Rotate tokens via /auth/refresh. Returns true on success. On failure the
     * session is cleared (the refresh token is invalid/expired/reused). This is
     * the function wired into the HTTP client's `refresh` auth hook, so it must
     * NOT throw — callers branch on the boolean.
     */
    async refresh(): Promise<boolean> {
      if (!this.refreshToken) {
        this.clear()
        return false
      }
      try {
        const pair = await authApi.refresh(this.refreshToken)
        this.setTokens(pair.accessToken, pair.refreshToken)
        return true
      } catch {
        this.clear()
        return false
      }
    },

    /** Best-effort sign out: revoke the refresh token, then wipe local state. */
    async logout(): Promise<void> {
      const token = this.refreshToken
      if (token) {
        try {
          await authApi.logout(token)
        } catch {
          // Logout is idempotent and best-effort; ignore network/API errors.
        }
      }
      this.clear()
    },

    /** Load the authenticated user's profile into the store. */
    async fetchMe(): Promise<User> {
      const user = await authApi.getMe()
      this.user = user
      return user
    },

    /** Update the profile (display name / password) and refresh local state. */
    async updateProfile(body: UpdateProfileRequest): Promise<User> {
      const user = await authApi.updateMe(body)
      this.user = user
      return user
    },
  },
})

/** Re-exported so consumers can narrow store errors without a separate import. */
export { isApiError }
