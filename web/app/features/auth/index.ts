// features/auth — public API of the authentication feature slice.
//
// Higher layers (pages, widgets, app) import ONLY from here. The login/register
// forms own all UI + error mapping; they submit through entities/user's session
// store (FSD: features depend on lower layers via their public APIs).

export { default as LoginForm } from './ui/LoginForm.vue'
export { default as RegisterForm } from './ui/RegisterForm.vue'

// Error-message helpers are exported for reuse and unit testing of the mapping.
export {
  authErrorMessage,
  fieldErrorsFrom,
  GENERIC_AUTH_ERROR,
} from './lib/errorMessages'
