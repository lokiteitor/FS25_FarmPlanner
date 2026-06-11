// entities/user/model/types — domain types for the authenticated user and the
// auth token contract. Derived from docs/openapi.yaml (User / TokenPair /
// AuthSession schemas) and the /auth/* request bodies.

/**
 * The authenticated user. Mirrors the `User` schema in openapi.yaml.
 * `displayName` is nullable in the contract (`type: [string, 'null']`).
 */
export interface User {
  id: string
  email: string
  displayName: string | null
  createdAt: string
}

/**
 * Access/refresh token pair returned by `/auth/refresh`. Matches the `TokenPair`
 * schema. `expiresIn` (access-token TTL in seconds) is optional in the contract.
 */
export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn?: number
}

/**
 * Result of a successful `/auth/register` or `/auth/login`: the user plus a
 * fresh token pair. Matches the `AuthSession` schema.
 */
export interface AuthSession {
  user: User
  accessToken: string
  refreshToken: string
  expiresIn?: number
}

/** Body for `POST /auth/register`. */
export interface RegisterRequest {
  email: string
  password: string
  displayName?: string
}

/** Body for `POST /auth/login`. */
export interface LoginRequest {
  email: string
  password: string
}

/**
 * Body for `PATCH /auth/me`. To change the password, `currentPassword` and
 * `newPassword` must be supplied together (see openapi.yaml).
 */
export interface UpdateProfileRequest {
  displayName?: string
  currentPassword?: string
  newPassword?: string
}

/** Lifecycle of the session store, used to drive UI (splash/guards/forms). */
export type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous'
