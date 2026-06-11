// features/stable-manage/lib/errorMessages — maps stable backend error codes
// (docs/openapi.yaml Conflict + ValidationError responses) to Spanish, user
// facing messages, and decides which ones target a specific field vs. the form
// banner. The backend `message` is developer-oriented; the UI shows these
// (docs/arquitectura-frontend.md §8.2).
//
// FSD: feature-private; re-exported via the slice public API for tests only.

import { ERROR_CODES, isApiError } from '~/shared/api'

/** Generic fallback when no specific mapping applies. */
export const GENERIC_STABLE_ERROR = 'Ha ocurrido un error. Inténtalo de nuevo.'

/**
 * Code -> Spanish general (form-level) message. Field-scoped codes
 * (DUPLICATE_STABLE_NAME -> name, COUNT_EXCEEDS_CAPACITY -> currentCount) are
 * handled by {@link stableFieldErrorsFrom}; the rest fall here.
 */
const STABLE_ERROR_MESSAGES: Record<string, string> = {
  // 422 — currentCount > maxCapacity. Also surfaced on the currentCount field.
  COUNT_EXCEEDS_CAPACITY: 'El número actual de animales supera la capacidad máxima.',
  // 409 — another stable in this farm already uses the name. Also on the name field.
  DUPLICATE_STABLE_NAME: 'Ya tienes un establo con ese nombre en esta partida.',
  // 422 generic validation with no usable field details.
  VALIDATION_ERROR: 'Revisa los datos introducidos.',
  // 404 — farm/stable not found or not owned.
  STABLE_NOT_FOUND: 'El establo no existe o no está disponible.',
  FARM_NOT_FOUND: 'La partida no existe o no está disponible.',
  // 429 — too many requests.
  RATE_LIMITED: 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.',
  // Transport failure (status 0).
  [ERROR_CODES.NETWORK_ERROR]: 'No se pudo conectar con el servidor.',
}

/**
 * Per-field errors derived from the error code (not from 422 details[]): the two
 * domain-specific stable codes map to a specific input so the user sees the
 * message next to the offending field. Returns `{}` for unrelated errors.
 */
export function stableFieldErrorsFrom(err: unknown): {
  name?: string
  currentCount?: string
} {
  if (!isApiError(err)) return {}
  const fields: { name?: string; currentCount?: string } = {}

  if (err.code === 'DUPLICATE_STABLE_NAME') {
    fields.name = STABLE_ERROR_MESSAGES.DUPLICATE_STABLE_NAME
  }
  if (err.code === 'COUNT_EXCEEDS_CAPACITY') {
    fields.currentCount = STABLE_ERROR_MESSAGES.COUNT_EXCEEDS_CAPACITY
  }

  // 422 VALIDATION_ERROR details[]: map known paths onto our fields.
  if (err.code === 'VALIDATION_ERROR' && err.details) {
    for (const detail of err.details) {
      if (detail.path === 'name' && !fields.name) {
        fields.name = detail.message || 'Valor no válido.'
      }
      if (
        (detail.path === 'currentCount' || detail.path === 'maxCapacity') &&
        !fields.currentCount
      ) {
        fields.currentCount = detail.message || 'Valor no válido.'
      }
    }
  }

  return fields
}

/**
 * Resolve a general (form-level) Spanish message from an unknown error. Returns
 * `null` when the error is fully explained by {@link stableFieldErrorsFrom}
 * (so the caller can avoid showing a redundant banner), otherwise a message.
 */
export function stableErrorMessage(err: unknown): string | null {
  if (!isApiError(err)) return GENERIC_STABLE_ERROR

  // Field-only codes: no general banner needed (the field shows the message).
  if (err.code === 'DUPLICATE_STABLE_NAME' || err.code === 'COUNT_EXCEEDS_CAPACITY') {
    return null
  }

  // 422 fully consumed by per-field details -> no general banner.
  if (err.code === 'VALIDATION_ERROR') {
    const fields = stableFieldErrorsFrom(err)
    if (fields.name || fields.currentCount) return null
  }

  return STABLE_ERROR_MESSAGES[err.code] ?? GENERIC_STABLE_ERROR
}
