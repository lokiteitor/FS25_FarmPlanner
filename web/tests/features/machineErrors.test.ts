// tests/features/machineErrors — machinery error-code -> Spanish message + 422
// per-field mapping (name/workingWidthM/workingSpeedKmh).

import { describe, expect, it } from 'vitest'
import { ApiError } from '~/shared/api'
// Import the pure mappers directly (not via the feature index, which also
// re-exports the .vue component — vitest has no Vue plugin configured).
import {
  GENERIC_MACHINE_ERROR,
  machineErrorMessage,
  machineFieldErrorsFrom,
} from '~/features/machinery-manage/lib/errorMessages'

function apiError(code: string, status = 422, details?: { path?: string; message: string }[]) {
  return new ApiError({ code, message: `dev: ${code}`, status, details })
}

describe('machineFieldErrorsFrom', () => {
  it('maps known 422 detail paths onto fields', () => {
    const fields = machineFieldErrorsFrom(
      apiError('VALIDATION_ERROR', 422, [
        { path: 'name', message: 'required' },
        { path: 'workingWidthM', message: 'must be > 0' },
        { path: 'workingSpeedKmh', message: 'must be > 0' },
      ]),
    )
    expect(fields.name).toBe('required')
    expect(fields.workingWidthM).toBe('must be > 0')
    expect(fields.workingSpeedKmh).toBe('must be > 0')
  })

  it('ignores unknown paths', () => {
    const fields = machineFieldErrorsFrom(
      apiError('VALIDATION_ERROR', 422, [{ path: 'farmId', message: 'nope' }]),
    )
    expect(fields).toEqual({})
  })

  it('returns {} for non-validation or non-ApiError errors', () => {
    expect(machineFieldErrorsFrom(apiError('MACHINE_NOT_FOUND', 404))).toEqual({})
    expect(machineFieldErrorsFrom(new Error('boom'))).toEqual({})
  })
})

describe('machineErrorMessage', () => {
  it('returns null when a 422 is fully explained per-field', () => {
    const err = apiError('VALIDATION_ERROR', 422, [{ path: 'name', message: 'bad' }])
    expect(machineErrorMessage(err)).toBeNull()
  })

  it('returns a Spanish banner for generic 422 with no field details', () => {
    expect(machineErrorMessage(apiError('VALIDATION_ERROR', 422))).toBe(
      'Revisa los datos introducidos.',
    )
  })

  it('maps not-found and rate-limited codes', () => {
    expect(machineErrorMessage(apiError('MACHINE_NOT_FOUND', 404))).toContain('máquina')
    expect(machineErrorMessage(apiError('RATE_LIMITED', 429))).toContain('Demasiadas')
  })

  it('falls back to the generic message for unknown errors', () => {
    expect(machineErrorMessage(new Error('boom'))).toBe(GENERIC_MACHINE_ERROR)
    expect(machineErrorMessage(apiError('SOMETHING_ELSE', 500))).toBe(GENERIC_MACHINE_ERROR)
  })
})
