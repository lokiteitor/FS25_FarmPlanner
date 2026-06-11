// tests/widgets/farm-summary/summary — internal-consistency tests for the pure
// dashboard aggregator. Assert that buildFarmSummary's totals agree with the
// engine's per-field cropProjection and that distribution/animal grouping are
// correct. NOT byte-parity with any prototype.

import { describe, expect, it } from 'vitest'
// Import the pure aggregator directly (not via the widget index, which also
// re-exports the .vue component — vitest has no Vue plugin configured).
import { buildFarmSummary } from '~/widgets/farm-summary/lib/summary'
import { cropProjection } from '~/shared/lib/engine'
import type { Field } from '~/entities/field'
import type { Stable } from '~/entities/stable'
import type { Crop } from '~/entities/catalog'
import {
  catalog,
  corn,
  wheat,
  normalFarm,
} from '../../engine/fixtures'

// Catalog crops carry an `id`; the engine fixtures are `EngineCrop` (no id), so
// we wrap them with ids matching the field.cropId references below.
const WHEAT_ID = 'crop-wheat'
const CORN_ID = 'crop-corn'

const cropsById = new Map<string, Crop>([
  [WHEAT_ID, { ...wheat, id: WHEAT_ID, nameEn: 'Wheat' } as Crop],
  [CORN_ID, { ...corn, id: CORN_ID, nameEn: 'Corn' } as Crop],
])
const cropById = (id: string): Crop | undefined => cropsById.get(id)

function field(over: Partial<Field>): Field {
  return {
    id: over.id ?? `f-${Math.random()}`,
    farmId: 'farm-1',
    fieldNumber: over.fieldNumber ?? 1,
    hectares: over.hectares ?? 1,
    cropId: over.cropId ?? null,
    isSilage: over.isSilage ?? false,
    yieldBonus: over.yieldBonus ?? null,
    purchasePrice: over.purchasePrice ?? null,
  }
}

function stable(species: Stable['species'], currentCount: number): Stable {
  return {
    id: `s-${species}-${currentCount}`,
    farmId: 'farm-1',
    name: species,
    species,
    maxCapacity: currentCount + 10,
    currentCount,
    config: {},
  }
}

describe('buildFarmSummary — KPIs', () => {
  it('counts fields/hectares and splits assigned vs fallow', () => {
    const fields = [
      field({ id: 'a', fieldNumber: 1, hectares: 10, cropId: WHEAT_ID }),
      field({ id: 'b', fieldNumber: 2, hectares: 5, cropId: CORN_ID }),
      field({ id: 'c', fieldNumber: 3, hectares: 3, cropId: null }),
    ]
    const s = buildFarmSummary(fields, [], catalog, normalFarm, cropById)

    expect(s.fieldCount).toBe(3)
    expect(s.totalHectares).toBe(18)
    expect(s.assignedHectares).toBe(15)
    expect(s.fallowHectares).toBe(3)
  })

  it('sums gross income to match per-field cropProjection', () => {
    const fields = [
      field({ id: 'a', fieldNumber: 1, hectares: 10, cropId: WHEAT_ID }),
      field({ id: 'b', fieldNumber: 2, hectares: 5, cropId: CORN_ID, yieldBonus: 0.6 }),
    ]
    const s = buildFarmSummary(fields, [], catalog, normalFarm, cropById)

    const expectedWheat = cropProjection(
      { ...wheat },
      { hectares: 10, yieldBonus: null, isSilage: false },
      normalFarm,
      catalog,
    ).grossIncome
    const expectedCorn = cropProjection(
      { ...corn },
      { hectares: 5, yieldBonus: 0.6, isSilage: false },
      normalFarm,
      catalog,
    ).grossIncome

    expect(s.totalGrossIncome).toBeCloseTo(expectedWheat + expectedCorn, 6)
  })

  it('ignores fallow fields and crops missing from the catalog', () => {
    const fields = [
      field({ id: 'a', fieldNumber: 1, hectares: 10, cropId: null }),
      field({ id: 'b', fieldNumber: 2, hectares: 4, cropId: 'unknown-crop' }),
    ]
    const s = buildFarmSummary(fields, [], catalog, normalFarm, cropById)

    expect(s.totalGrossIncome).toBe(0)
    expect(s.assignedHectares).toBe(0)
    expect(s.cropDistribution).toHaveLength(0)
  })
})

describe('buildFarmSummary — crop distribution', () => {
  it('groups fields by crop and sorts by descending hectares', () => {
    const fields = [
      field({ id: 'a', fieldNumber: 1, hectares: 2, cropId: WHEAT_ID }),
      field({ id: 'b', fieldNumber: 2, hectares: 3, cropId: WHEAT_ID }),
      field({ id: 'c', fieldNumber: 3, hectares: 10, cropId: CORN_ID }),
    ]
    const s = buildFarmSummary(fields, [], catalog, normalFarm, cropById)

    expect(s.cropDistribution.map((r) => r.slug)).toEqual(['corn', 'wheat'])
    const wheatRow = s.cropDistribution.find((r) => r.slug === 'wheat')
    expect(wheatRow?.fieldCount).toBe(2)
    expect(wheatRow?.hectares).toBe(5)
    expect(wheatRow?.nameEs).toBe('Trigo')
  })

  it('aggregated yield/income equal the sum of per-field projections', () => {
    const fields = [
      field({ id: 'a', fieldNumber: 1, hectares: 2, cropId: WHEAT_ID }),
      field({ id: 'b', fieldNumber: 2, hectares: 3, cropId: WHEAT_ID }),
    ]
    const s = buildFarmSummary(fields, [], catalog, normalFarm, cropById)
    const row = s.cropDistribution.find((r) => r.slug === 'wheat')!

    const p1 = cropProjection({ ...wheat }, { hectares: 2 }, normalFarm, catalog)
    const p2 = cropProjection({ ...wheat }, { hectares: 3 }, normalFarm, catalog)

    expect(row.yieldLiters).toBeCloseTo(p1.yieldLiters + p2.yieldLiters, 6)
    expect(row.grossIncome).toBeCloseTo(p1.grossIncome + p2.grossIncome, 6)
  })
})

describe('buildFarmSummary — animals', () => {
  it('totals head counts and groups by species (descending)', () => {
    const stables = [
      stable('cow', 30),
      stable('cow', 20),
      stable('chicken', 100),
    ]
    const s = buildFarmSummary([], stables, catalog, normalFarm, cropById)

    expect(s.stableCount).toBe(3)
    expect(s.totalAnimals).toBe(150)
    expect(s.animalsBySpecies).toEqual([
      { species: 'chicken', count: 100 },
      { species: 'cow', count: 50 },
    ])
  })

  it('is empty for a farm with no fields or stables', () => {
    const s = buildFarmSummary([], [], catalog, normalFarm, cropById)
    expect(s.fieldCount).toBe(0)
    expect(s.stableCount).toBe(0)
    expect(s.totalAnimals).toBe(0)
    expect(s.cropDistribution).toHaveLength(0)
    expect(s.animalsBySpecies).toHaveLength(0)
    expect(s.totalGrossIncome).toBe(0)
  })
})
