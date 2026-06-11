// Unit tests for the field-manage error-message mapping. Verifies the
// field-specific backend codes (docs/openapi.yaml Fields tag) map to friendly
// Spanish strings and to the right form control.

import { describe, expect, it } from 'vitest'
import { ApiError } from '~/shared/api'
// Import the pure lib module directly (not the slice index) so this test never
// pulls .vue SFCs into the non-Vue vitest environment. The slice index re-exports
// these same symbols for the app.
import {
  fieldErrorMessage,
  fieldScopedError,
  GENERIC_FIELD_ERROR,
} from '~/features/field-manage/lib/errorMessages'

function apiError(code: string, message = 'dev message', extra?: Partial<ApiError>) {
  return new ApiError({
    code,
    message,
    status: (extra?.status as number) ?? 422,
    details: extra?.details,
  })
}

describe('fieldErrorMessage', () => {
  it('maps DUPLICATE_FIELD_NUMBER (409) to Spanish', () => {
    expect(fieldErrorMessage(apiError('DUPLICATE_FIELD_NUMBER', 'dup', { status: 409 }))).toBe(
      'Ya existe un campo con ese número en la partida.',
    )
  })

  it('maps CROP_VERSION_MISMATCH to Spanish', () => {
    expect(fieldErrorMessage(apiError('CROP_VERSION_MISMATCH'))).toBe(
      'El cultivo no pertenece a la versión de la partida.',
    )
  })

  it('maps SILAGE_NOT_SUPPORTED_FOR_CROP to Spanish', () => {
    expect(fieldErrorMessage(apiError('SILAGE_NOT_SUPPORTED_FOR_CROP'))).toBe(
      'El cultivo seleccionado no admite ensilaje.',
    )
  })

  it('falls back to the backend message for unmapped ApiError codes', () => {
    expect(fieldErrorMessage(apiError('SOMETHING_ELSE', 'servidor caído'))).toBe('servidor caído')
  })

  it('falls back to the generic message for non-ApiError values', () => {
    expect(fieldErrorMessage(new Error('boom'))).toBe(GENERIC_FIELD_ERROR)
    expect(fieldErrorMessage('nope')).toBe(GENERIC_FIELD_ERROR)
  })
})

describe('fieldScopedError', () => {
  it('targets fieldNumber for DUPLICATE_FIELD_NUMBER', () => {
    expect(fieldScopedError(apiError('DUPLICATE_FIELD_NUMBER', 'x', { status: 409 }))).toEqual({
      fieldNumber: 'Ya existe un campo con ese número en la partida.',
    })
  })

  it('targets cropId for CROP_VERSION_MISMATCH', () => {
    expect(fieldScopedError(apiError('CROP_VERSION_MISMATCH'))).toEqual({
      cropId: 'El cultivo no pertenece a la versión de la partida.',
    })
  })

  it('targets isSilage for SILAGE_NOT_SUPPORTED_FOR_CROP', () => {
    expect(fieldScopedError(apiError('SILAGE_NOT_SUPPORTED_FOR_CROP'))).toEqual({
      isSilage: 'El cultivo seleccionado no admite ensilaje.',
    })
  })

  it('extracts per-field details from a generic VALIDATION_ERROR', () => {
    const err = apiError('VALIDATION_ERROR', 'invalid', {
      details: [{ path: 'hectares', message: 'must be > 0' }],
    })
    expect(fieldScopedError(err)).toEqual({ hectares: 'must be > 0' })
  })

  it('returns {} for non-field-scoped errors (caller shows the banner)', () => {
    expect(fieldScopedError(apiError('RATE_LIMITED', 'slow down', { status: 429 }))).toEqual({})
    expect(fieldScopedError(new Error('boom'))).toEqual({})
  })
})
