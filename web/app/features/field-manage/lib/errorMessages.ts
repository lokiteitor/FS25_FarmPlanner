// features/field-manage/lib/errorMessages — maps the field-specific backend
// error codes (docs/openapi.yaml: Conflict / ValidationError responses for the
// Fields tag) to Spanish, user-facing messages for the field form. The backend
// `message` is developer-oriented; the UI shows these localized strings instead
// (docs/arquitectura-frontend.md §8.2: "code se mapea a mensajes localizados").
//
// FSD: feature-private logic; re-exported (for tests) via the slice public API,
// never imported across slices directly.

import { ERROR_CODES, isApiError } from '~/shared/api'

/** Generic fallback shown when no specific mapping applies. */
export const GENERIC_FIELD_ERROR = 'No se pudo guardar el campo. Inténtalo de nuevo.'

/**
 * Code -> Spanish general (form-level) message for the field form.
 *   - 409 DUPLICATE_FIELD_NUMBER — fieldNumber already used in the partida.
 *   - 422 CROP_VERSION_MISMATCH — crop belongs to another game version.
 *   - 422 SILAGE_NOT_SUPPORTED_FOR_CROP — crop has no silage variant.
 *   - 422 VALIDATION_ERROR — generic validation (field details handled apart).
 */
const FIELD_ERROR_MESSAGES: Record<string, string> = {
  DUPLICATE_FIELD_NUMBER: 'Ya existe un campo con ese número en la partida.',
  CROP_VERSION_MISMATCH: 'El cultivo no pertenece a la versión de la partida.',
  SILAGE_NOT_SUPPORTED_FOR_CROP: 'El cultivo seleccionado no admite ensilaje.',
  VALIDATION_ERROR: 'Revisa los datos introducidos.',
  [ERROR_CODES.NETWORK_ERROR]: 'No se pudo conectar con el servidor.',
}

/**
 * Field paths from a 422 VALIDATION_ERROR that map to a specific form input.
 * Codes that target the whole crop/silage selection are surfaced under those
 * fields too so the user sees the message next to the control.
 */
const CODE_TO_FIELD: Record<string, string> = {
  DUPLICATE_FIELD_NUMBER: 'fieldNumber',
  CROP_VERSION_MISMATCH: 'cropId',
  SILAGE_NOT_SUPPORTED_FOR_CROP: 'isSilage',
}

/**
 * Resolve a general (form-level) Spanish message from an unknown error.
 * Non-ApiError values (or unmapped codes) fall back to {@link GENERIC_FIELD_ERROR}.
 */
export function fieldErrorMessage(err: unknown): string {
  if (!isApiError(err)) return GENERIC_FIELD_ERROR
  return FIELD_ERROR_MESSAGES[err.code] ?? err.message ?? GENERIC_FIELD_ERROR
}

/**
 * Map an error to a single { field: message } pair when the error code targets a
 * specific control (DUPLICATE_FIELD_NUMBER -> fieldNumber, CROP_VERSION_MISMATCH
 * -> cropId, SILAGE_NOT_SUPPORTED_FOR_CROP -> isSilage). Returns {} when the
 * error is not field-scoped (caller shows the general banner instead).
 */
export function fieldScopedError(err: unknown): Record<string, string> {
  if (!isApiError(err)) return {}

  // Domain codes that map cleanly to one control.
  const target = CODE_TO_FIELD[err.code]
  if (target) {
    return { [target]: FIELD_ERROR_MESSAGES[err.code] ?? err.message }
  }

  // Generic 422 with per-field details (e.g. hectares must be > 0).
  if (err.code === 'VALIDATION_ERROR' && err.details) {
    const out: Record<string, string> = {}
    for (const detail of err.details) {
      if (detail.path && !(detail.path in out)) {
        out[detail.path] = detail.message || 'Valor no válido.'
      }
    }
    return out
  }

  return {}
}
