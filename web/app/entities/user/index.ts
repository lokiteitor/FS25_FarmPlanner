// entities/user — public API of the user/session slice.
//
// Higher layers (app, pages, widgets, features) import ONLY from here; the
// internal model/api modules are private to the slice (FSD cross-slice rule).

export { useSessionStore } from './model/session.store'

export * as authApi from './api/authApi'

export type {
  User,
  TokenPair,
  AuthSession,
  RegisterRequest,
  LoginRequest,
  UpdateProfileRequest,
  SessionStatus,
} from './model/types'
