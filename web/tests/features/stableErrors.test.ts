// tests/features/stableErrors — stable error-code -> Spanish message + per-field
// mapping (COUNT_EXCEEDS_CAPACITY, DUPLICATE_STABLE_NAME, 422 details).

import { describe, expect, it } from 'vitest'
import { ApiError } from '~/shared/api'
// Import the pure mappers directly (not via the feature index, which also
// re-exports the .vue component — vitest has no Vue plugin configured).
import {
  GENERIC_STABLE_ERROR,
  stableErrorMessage,
  stableFieldErrorsFrom,
} from '~/features/stable-manage/lib/errorMessages'

function apiError(code: string, status = 422, details?: { path?: string; message: string }[]) {
  return new ApiError({ code, message: `dev: ${code}`, status, details })
}

describe('stableFieldErrorsFrom', () => {
  it('maps DUPLICATE_STABLE_NAME to the name field', () => {
    const fields = stableFieldErrorsFrom(apiError('DUPLICATE_STABLE_NAME', 409))
    expect(fields.name).toContain('nombre')
    expect(fields.currentCount).toBeUndefined()
  })

  it('maps COUNT_EXCEEDS_CAPACITY to the currentCount field', () => {
    const fields = stableFieldErrorsFrom(apiError('COUNT_EXCEEDS_CAPACITY', 422))
    expect(fields.currentCount).toContain('capacidad')
    expect(fields.name).toBeUndefined()
  })

  it('maps 422 details[] paths onto fields', () => {
    const fields = stableFieldErrorsFrom(
      apiError('VALIDATION_ERROR', 422, [
        { path: 'name', message: 'too short' },
        { path: 'maxCapacity', message: 'must be >= 1' },
      ]),
    )
    expect(fields.name).toBe('too short')
    expect(fields.currentCount).toBe('must be >= 1')
  })

  it('returns {} for non-ApiError values', () => {
    expect(stableFieldErrorsFrom(new Error('boom'))).toEqual({})
    expect(stableFieldErrorsFrom('nope')).toEqual({})
  })
})

describe('stableErrorMessage', () => {
  it('returns null for field-only codes (no redundant banner)', () => {
    expect(stableErrorMessage(apiError('DUPLICATE_STABLE_NAME', 409))).toBeNull()
    expect(stableErrorMessage(apiError('COUNT_EXCEEDS_CAPACITY', 422))).toBeNull()
  })

  it('returns null when a 422 is fully explained per-field', () => {
    const err = apiError('VALIDATION_ERROR', 422, [{ path: 'name', message: 'bad' }])
    expect(stableErrorMessage(err)).toBeNull()
  })

  it('returns a Spanish banner for generic 422 with no field details', () => {
    expect(stableErrorMessage(apiError('VALIDATION_ERROR', 422))).toBe(
      'Revisa los datos introducidos.',
    )
  })

  it('maps not-found and rate-limited codes', () => {
    expect(stableErrorMessage(apiError('STABLE_NOT_FOUND', 404))).toContain('establo')
    expect(stableErrorMessage(apiError('RATE_LIMITED', 429))).toContain('Demasiadas')
  })

  it('falls back to the generic message for unknown errors', () => {
    expect(stableErrorMessage(new Error('boom'))).toBe(GENERIC_STABLE_ERROR)
    expect(stableErrorMessage(apiError('SOMETHING_ELSE', 500))).toBe(GENERIC_STABLE_ERROR)
  })
})
