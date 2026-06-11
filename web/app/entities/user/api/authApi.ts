// entities/user/api/authApi — typed wrappers over `shared/api` for the
// `/auth/*` endpoints (docs/openapi.yaml, Auth tag).
//
// FSD: entities may depend on `shared`. Components/features must go through the
// session store, never call this module's network functions directly with raw
// `$fetch` (docs/arquitectura-frontend.md §8.1).
//
// `auth: false` is passed on login/register/refresh/logout so the client does
// NOT attach an Authorization header (these run with no access token, or carry
// the refresh token in the body instead).

import { get, patch, post } from '~/shared/api'
import type {
  AuthSession,
  LoginRequest,
  RegisterRequest,
  TokenPair,
  UpdateProfileRequest,
  User,
} from '../model/types'

/** POST /auth/register — create an account and start a session. */
export function register(body: RegisterRequest): Promise<AuthSession> {
  return post<AuthSession>('/auth/register', body, { auth: false })
}

/** POST /auth/login — exchange credentials for a session. */
export function login(body: LoginRequest): Promise<AuthSession> {
  return post<AuthSession>('/auth/login', body, { auth: false })
}

/** POST /auth/refresh — rotate the refresh token and get a fresh token pair. */
export function refresh(refreshToken: string): Promise<TokenPair> {
  return post<TokenPair>('/auth/refresh', { refreshToken }, { auth: false })
}

/**
 * POST /auth/logout — revoke the current refresh token (idempotent, 204).
 * Best-effort: callers should not block sign-out on its outcome.
 */
export function logout(refreshToken: string): Promise<void> {
  return post<void>('/auth/logout', { refreshToken }, { auth: false })
}

/** GET /auth/me — the authenticated user's profile (needs access token). */
export async function getMe(): Promise<User> {
  const { data } = await get<User>('/auth/me')
  return data
}

/** PATCH /auth/me — update display name and/or password. */
export function updateMe(body: UpdateProfileRequest): Promise<User> {
  return patch<User>('/auth/me', body)
}
