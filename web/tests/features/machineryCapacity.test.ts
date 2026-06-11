// tests/features/machineryCapacity — theoretical capacity helper tests.
// Relationship under test: ha/h = width(m) * speed(km/h) / 10.

import { describe, expect, it } from 'vitest'
// Import the pure helper directly (not via the feature index, which also
// re-exports the .vue component — vitest has no Vue plugin configured).
import {
  formatCapacity,
  theoreticalCapacityHaPerH,
} from '~/features/machinery-manage/lib/capacity'

describe('theoreticalCapacityHaPerH', () => {
  it('computes width*speed/10 (ha/h)', () => {
    // 6 m at 12 km/h -> 6*12/10 = 7.2 ha/h
    expect(theoreticalCapacityHaPerH(6, 12)).toBeCloseTo(7.2)
    // 3 m at 10 km/h -> 3 ha/h
    expect(theoreticalCapacityHaPerH(3, 10)).toBeCloseTo(3)
  })

  it('is dimensionally consistent: 1 ha = 10000 m²', () => {
    // width 1 m, speed 1 km/h sweeps 1*1000 m²/h = 1000 m²/h = 0.1 ha/h.
    expect(theoreticalCapacityHaPerH(1, 1)).toBeCloseTo(0.1)
  })

  it('scales linearly with both inputs', () => {
    const base = theoreticalCapacityHaPerH(4, 8)
    expect(theoreticalCapacityHaPerH(8, 8)).toBeCloseTo(base * 2)
    expect(theoreticalCapacityHaPerH(4, 16)).toBeCloseTo(base * 2)
  })

  it('returns 0 for non-positive or non-finite inputs', () => {
    expect(theoreticalCapacityHaPerH(0, 10)).toBe(0)
    expect(theoreticalCapacityHaPerH(10, 0)).toBe(0)
    expect(theoreticalCapacityHaPerH(-5, 10)).toBe(0)
    expect(theoreticalCapacityHaPerH(Number.NaN, 10)).toBe(0)
  })
})

describe('formatCapacity', () => {
  it('formats to 2 decimals with the ha/h unit', () => {
    expect(formatCapacity(6, 12)).toBe('7.20 ha/h')
    expect(formatCapacity(0, 0)).toBe('0.00 ha/h')
  })
})
