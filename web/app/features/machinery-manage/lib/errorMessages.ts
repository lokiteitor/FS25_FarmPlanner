// features/machinery-manage/lib/errorMessages — maps machinery backend error
// codes (docs/openapi.yaml ValidationError + NotFound + RateLimited) to Spanish
// messages and per-field errors. The backend `message` is developer-oriented;
// the UI shows these (docs/arquitectura-frontend.md §8.2).
//
// FSD: feature-private; re-exported via the slice public API for tests only.

import { ERROR_CODES, isApiError } from '~/shared/api'

/** Generic fallback when no specific mapping applies. */
export const GENERIC_MACHINE_ERROR = 'Ha ocurrido un error. Inténtalo de nuevo.'

/** Code -> Spanish general (form-level) message. */
const MACHINE_ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Revisa los datos introducidos.',
  MACHINE_NOT_FOUND: 'La máquina no existe o no está disponible.',
  FARM_NOT_FOUND: 'La partida no existe o no está disponible.',
  RATE_LIMITED: 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.',
  [ERROR_CODES.NETWORK_ERROR]: 'No se pudo conectar con el servidor.',
}

/** Form fields the machinery form can surface per-field errors on. */
const FIELD_PATHS = ['name', 'workingWidthM', 'workingSpeedKmh'] as const
type MachineField = (typeof FIELD_PATHS)[number]

/**
 * Per-field errors from a 422 VALIDATION_ERROR details[] array, keyed by the
 * field path (name/workingWidthM/workingSpeedKmh). Returns `{}` otherwise.
 */
export function machineFieldErrorsFrom(err: unknown): Partial<Record<MachineField, string>> {
  if (!isApiError(err) || err.code !== 'VALIDATION_ERROR' || !err.details) return {}
  const fields: Partial<Record<MachineField, string>> = {}
  for (const detail of err.details) {
    const path = detail.path as MachineField | undefined
    if (path && FIELD_PATHS.includes(path) && !fields[path]) {
      fields[path] = detail.message || 'Valor no válido.'
    }
  }
  return fields
}

/**
 * Resolve a general (form-level) Spanish message, or `null` when the error is
 * fully explained by {@link machineFieldErrorsFrom} (so no redundant banner).
 */
export function machineErrorMessage(err: unknown): string | null {
  if (!isApiError(err)) return GENERIC_MACHINE_ERROR
  if (err.code === 'VALIDATION_ERROR') {
    const fields = machineFieldErrorsFrom(err)
    if (Object.keys(fields).length > 0) return null
  }
  return MACHINE_ERROR_MESSAGES[err.code] ?? GENERIC_MACHINE_ERROR
}
