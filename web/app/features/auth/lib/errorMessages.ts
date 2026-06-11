// features/auth/lib/errorMessages — maps backend error codes (docs/openapi.yaml,
// Auth tag + components.responses) to Spanish, user-facing messages for the auth
// forms. The backend `message` is for developers; the UI shows these instead
// (docs/arquitectura-frontend.md §8.2: "code se mapea a mensajes localizados").
//
// FSD: this is feature-private logic; it lives under the slice and is re-exported
// (for tests) via the slice public API, never imported across slices directly.

import { ERROR_CODES, isApiError } from '~/shared/api'

/** Generic fallback shown when no specific mapping applies. */
export const GENERIC_AUTH_ERROR = 'Ha ocurrido un error. Inténtalo de nuevo.'

/**
 * Code -> Spanish general (form-level) message. Field-level 422 details are
 * handled separately (they target individual inputs); these are the messages
 * shown in the form's general error banner.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  // 401 — login: same code for wrong password and unknown email (by design).
  INVALID_CREDENTIALS: 'Email o contraseña incorrectos.',
  // 409 — register: email already taken.
  EMAIL_ALREADY_REGISTERED: 'Ese email ya está registrado.',
  // 429 — too many attempts on login/register.
  RATE_LIMITED: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  // Transport failure (status 0).
  [ERROR_CODES.NETWORK_ERROR]: 'No se pudo conectar con el servidor.',
  // 422 with no usable field details: show a generic validation hint.
  VALIDATION_ERROR: 'Revisa los datos introducidos.',
}

/**
 * Resolve a general (form-level) Spanish message from an unknown error.
 * Non-ApiError values (or unmapped codes) fall back to {@link GENERIC_AUTH_ERROR}.
 */
export function authErrorMessage(err: unknown): string {
  if (!isApiError(err)) return GENERIC_AUTH_ERROR
  return AUTH_ERROR_MESSAGES[err.code] ?? GENERIC_AUTH_ERROR
}

/**
 * Extract per-field errors from a 422 VALIDATION_ERROR `details[]` array,
 * keyed by the field path (e.g. `email`, `password`, `displayName`). Detail
 * messages come from the backend (developer-oriented) but are field-scoped, so
 * we surface them under the matching input; entries without a `path` are ignored
 * here and should be folded into the general message by the caller.
 */
export function fieldErrorsFrom(err: unknown): Record<string, string> {
  if (!isApiError(err) || !err.details) return {}
  const fields: Record<string, string> = {}
  for (const detail of err.details) {
    if (detail.path && !(detail.path in fields)) {
      fields[detail.path] = detail.message || 'Valor no válido.'
    }
  }
  return fields
}
