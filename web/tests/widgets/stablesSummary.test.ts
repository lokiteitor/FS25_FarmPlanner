// tests/widgets/stablesSummary — pure aggregation tests for the stables-summary
// widget helper (per-species totals, grand totals, utilization guard).

import { describe, expect, it } from 'vitest'
// Import the pure helpers directly (not via the widget index, which also
// re-exports the .vue component — vitest has no Vue plugin configured).
import {
  summarizeBySpecies,
  totalsOf,
  utilizationOf,
} from '~/widgets/stables-summary/lib/summarize'
import type { Stable } from '~/entities/stable'

function stable(partial: Partial<Stable> & Pick<Stable, 'species' | 'currentCount' | 'maxCapacity'>): Stable {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    farmId: 'farm-1',
    name: partial.name ?? 'Establo',
    config: partial.config ?? {},
    ...partial,
  }
}

describe('utilizationOf', () => {
  it('returns animals / capacity', () => {
    expect(utilizationOf(50, 100)).toBe(0.5)
    expect(utilizationOf(100, 100)).toBe(1)
  })

  it('returns 0 when capacity is 0 (no divide-by-zero)', () => {
    expect(utilizationOf(0, 0)).toBe(0)
    expect(utilizationOf(5, 0)).toBe(0)
  })

  it('can exceed 1 when over capacity', () => {
    expect(utilizationOf(120, 100)).toBeCloseTo(1.2)
  })
})

describe('summarizeBySpecies', () => {
  it('groups stables and sums count, animals and capacity per species', () => {
    const stables = [
      stable({ species: 'cow', currentCount: 10, maxCapacity: 20 }),
      stable({ species: 'cow', currentCount: 5, maxCapacity: 10 }),
      stable({ species: 'pig', currentCount: 8, maxCapacity: 8 }),
    ]
    const result = summarizeBySpecies(stables)

    const cow = result.find((r) => r.species === 'cow')!
    expect(cow.stableCount).toBe(2)
    expect(cow.animals).toBe(15)
    expect(cow.capacity).toBe(30)
    expect(cow.utilization).toBe(0.5)

    const pig = result.find((r) => r.species === 'pig')!
    expect(pig.stableCount).toBe(1)
    expect(pig.animals).toBe(8)
    expect(pig.utilization).toBe(1)
  })

  it('returns an empty array for no stables', () => {
    expect(summarizeBySpecies([])).toEqual([])
  })

  it('only includes species that have at least one stable', () => {
    const result = summarizeBySpecies([
      stable({ species: 'chicken', currentCount: 0, maxCapacity: 100 }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0]!.species).toBe('chicken')
    expect(result[0]!.utilization).toBe(0)
  })
})

describe('totalsOf', () => {
  it('sums across every species', () => {
    const stables = [
      stable({ species: 'cow', currentCount: 10, maxCapacity: 20 }),
      stable({ species: 'pig', currentCount: 8, maxCapacity: 8 }),
      stable({ species: 'horse', currentCount: 2, maxCapacity: 12 }),
    ]
    const totals = totalsOf(stables)
    expect(totals.stableCount).toBe(3)
    expect(totals.animals).toBe(20)
    expect(totals.capacity).toBe(40)
    expect(totals.utilization).toBe(0.5)
  })

  it('handles an empty farm', () => {
    expect(totalsOf([])).toEqual({
      stableCount: 0,
      animals: 0,
      capacity: 0,
      utilization: 0,
    })
  })

  it('per-species sums and the grand total are consistent', () => {
    const stables = [
      stable({ species: 'cow', currentCount: 10, maxCapacity: 20 }),
      stable({ species: 'cow', currentCount: 5, maxCapacity: 10 }),
      stable({ species: 'sheep', currentCount: 30, maxCapacity: 40 }),
    ]
    const totals = totalsOf(stables)
    const bySpecies = summarizeBySpecies(stables)
    expect(bySpecies.reduce((s, r) => s + r.animals, 0)).toBe(totals.animals)
    expect(bySpecies.reduce((s, r) => s + r.capacity, 0)).toBe(totals.capacity)
    expect(bySpecies.reduce((s, r) => s + r.stableCount, 0)).toBe(totals.stableCount)
  })
})
