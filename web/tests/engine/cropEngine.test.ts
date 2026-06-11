// tests/engine/cropEngine — internal-consistency tests for the crop engine.
// Assert documented relationships, NOT byte-parity with the prototype.

import { describe, expect, it } from 'vitest'
import {
  areaM2,
  compareCrops,
  cropPricePerLiter,
  cropProjection,
  cropYieldLiters,
  effectiveYieldBonus,
  incomeByDifficulty,
  seedLitersForHectares,
} from '~/shared/lib/engine'
import {
  catalog,
  corn,
  constants,
  crops,
  easyFarm,
  grass,
  hardFarm,
  maxSeasonalFarm,
  normalFarm,
  poplar,
  wheat,
} from './fixtures'

describe('areaM2', () => {
  it('converts hectares to m² (1 ha = 10 000 m²)', () => {
    expect(areaM2(1)).toBe(10000)
    expect(areaM2(2.5)).toBe(25000)
    expect(areaM2(0)).toBe(0)
  })
})

describe('effectiveYieldBonus', () => {
  it('uses the field override when provided', () => {
    expect(effectiveYieldBonus(0.6, normalFarm)).toBe(0.6)
    expect(effectiveYieldBonus(0, normalFarm)).toBe(0)
  })
  it('falls back to the farm default when null/undefined', () => {
    expect(effectiveYieldBonus(null, normalFarm)).toBe(0.425)
    expect(effectiveYieldBonus(undefined, normalFarm)).toBe(0.425)
  })
})

describe('cropPricePerLiter', () => {
  it('baseline uses basePrice', () => {
    expect(cropPricePerLiter(wheat, 'baseline')).toBe(wheat.basePrice)
  })
  it('max_seasonal multiplies by maxPriceFactor', () => {
    expect(cropPricePerLiter(wheat, 'max_seasonal')).toBeCloseTo(wheat.basePrice * wheat.maxPriceFactor, 10)
  })
})

describe('cropYieldLiters scales with (1 + bonus)', () => {
  it('doubling-ish: bonus 0 vs 0.425', () => {
    const area = areaM2(10)
    const noBonus = cropYieldLiters(wheat, area, 0)
    const withBonus = cropYieldLiters(wheat, area, 0.425)
    expect(noBonus).toBeCloseTo(area * wheat.yieldPerM2, 6)
    expect(withBonus / noBonus).toBeCloseTo(1.425, 10)
  })
})

describe('seedLitersForHectares', () => {
  it('= areaM2 * seedRate', () => {
    expect(seedLitersForHectares(wheat, 5)).toBeCloseTo(areaM2(5) * wheat.seedRate, 6)
  })
})

describe('incomeByDifficulty', () => {
  it('easy == 3 * hard and normal == 1.8 * hard', () => {
    const inc = incomeByDifficulty(wheat, 10, 0.425, constants)
    expect(inc.easy).toBeCloseTo(3 * inc.hard, 8)
    expect(inc.normal).toBeCloseTo(1.8 * inc.hard, 8)
  })
  it('hard equals raw liters * price', () => {
    const inc = incomeByDifficulty(wheat, 10, 0.425, constants)
    const liters = cropYieldLiters(wheat, areaM2(10), 0.425)
    expect(inc.hard).toBeCloseTo(liters * wheat.basePrice, 6)
  })
})

describe('cropProjection — normal crop', () => {
  const result = cropProjection(wheat, { hectares: 10 }, normalFarm, catalog)

  it('computes area, bonus and seed liters', () => {
    expect(result.areaM2).toBe(100000)
    expect(result.effectiveYieldBonus).toBe(0.425)
    expect(result.seedLitersNeeded).toBeCloseTo(100000 * wheat.seedRate, 6)
    expect(result.isSilage).toBe(false)
  })

  it('grossIncome = yieldLiters * price * normal scalar (1.8)', () => {
    const liters = cropYieldLiters(wheat, 100000, 0.425)
    expect(result.yieldLiters).toBeCloseTo(liters, 6)
    expect(result.pricePerLiter).toBe(wheat.basePrice)
    expect(result.grossIncome).toBeCloseTo(liters * wheat.basePrice * 1.8, 4)
  })

  it('grossIncome equals incomeByDifficulty[difficulty]', () => {
    expect(result.grossIncome).toBeCloseTo(result.incomeByDifficulty.normal, 6)
  })

  it('yieldM3 = liters / 1000', () => {
    expect(result.yieldM3).toBeCloseTo(result.yieldLiters / 1000, 6)
  })

  it('yieldTons = m³ * weightPerLiter (proto units, not liters * weight)', () => {
    expect(result.yieldTons).toBeCloseTo(result.yieldM3 * wheat.weightPerLiter, 6)
    // explicitly NOT liters * weight (that was the 1000× bug)
    expect(result.yieldTons).toBeCloseTo((result.yieldLiters / 1000) * wheat.weightPerLiter, 6)
  })
})

describe('cropProjection — baseline/maxSeasonal income tables', () => {
  it('always exposes both tables regardless of farm.sellPriceType', () => {
    const base = cropProjection(wheat, { hectares: 10 }, normalFarm, catalog)
    const liters = cropYieldLiters(wheat, areaM2(10), 0.425)
    // baseline uses basePrice; maxSeasonal multiplies by maxPriceFactor.
    expect(base.incomeBaseline.hard).toBeCloseTo(liters * wheat.basePrice, 6)
    expect(base.incomeMaxSeasonal.hard).toBeCloseTo(
      liters * wheat.basePrice * wheat.maxPriceFactor,
      6,
    )
    // incomeByDifficulty follows the farm (baseline farm => equals incomeBaseline).
    expect(base.incomeByDifficulty.hard).toBeCloseTo(base.incomeBaseline.hard, 6)
  })

  it('max_seasonal farm: incomeByDifficulty equals incomeMaxSeasonal', () => {
    const max = cropProjection(wheat, { hectares: 10 }, maxSeasonalFarm, catalog)
    expect(max.incomeByDifficulty.normal).toBeCloseTo(max.incomeMaxSeasonal.normal, 6)
    // both tables still present and distinct for a crop with maxPriceFactor > 1
    expect(max.incomeMaxSeasonal.hard / max.incomeBaseline.hard).toBeCloseTo(
      wheat.maxPriceFactor,
      8,
    )
  })

  it('silage: max-seasonal equals baseline (no seasonal silage path)', () => {
    const sil = cropProjection(poplar, { hectares: 10, isSilage: true }, maxSeasonalFarm, catalog)
    expect(sil.incomeMaxSeasonal.easy).toBeCloseTo(sil.incomeBaseline.easy, 6)
    expect(sil.incomeByDifficulty.easy).toBeCloseTo(sil.incomeBaseline.easy, 6)
  })
})

describe('cropProjection — difficulty scaling', () => {
  it('easy gross == 3 * hard gross for the same field', () => {
    const easy = cropProjection(wheat, { hectares: 10 }, easyFarm, catalog)
    const hard = cropProjection(wheat, { hectares: 10 }, hardFarm, catalog)
    expect(easy.grossIncome).toBeCloseTo(3 * hard.grossIncome, 4)
  })
})

describe('cropProjection — max_seasonal', () => {
  it('exceeds baseline by exactly maxPriceFactor', () => {
    const base = cropProjection(wheat, { hectares: 10 }, normalFarm, catalog)
    const max = cropProjection(wheat, { hectares: 10 }, maxSeasonalFarm, catalog)
    expect(max.pricePerLiter / base.pricePerLiter).toBeCloseTo(wheat.maxPriceFactor, 10)
    expect(max.grossIncome / base.grossIncome).toBeCloseTo(wheat.maxPriceFactor, 8)
  })
})

describe('cropProjection — yield scales with bonus', () => {
  it('yieldLiters proportional to (1 + bonus)', () => {
    const a = cropProjection(wheat, { hectares: 10, yieldBonus: 0 }, normalFarm, catalog)
    const b = cropProjection(wheat, { hectares: 10, yieldBonus: 1 }, normalFarm, catalog)
    expect(b.yieldLiters / a.yieldLiters).toBeCloseTo(2, 10)
    expect(b.grossIncome / a.grossIncome).toBeCloseTo(2, 8)
  })
})

describe('cropProjection — silage path', () => {
  it('uses silage yield * chaff * silagePrice (poplar silage)', () => {
    const res = cropProjection(poplar, { hectares: 10, isSilage: true }, normalFarm, catalog)
    expect(res.isSilage).toBe(true)
    // poplar silage: yieldPerM2 6.627, chaff 3.0
    const expectedLiters = 100000 * 6.627 * 3.0 * (1 + 0.425)
    expect(res.yieldLiters).toBeCloseTo(expectedLiters, 2)
    expect(res.pricePerLiter).toBe(constants.silagePrice)
    expect(res.grossIncome).toBeCloseTo(expectedLiters * constants.silagePrice * 1.8, 2)
    // tonnage uses silage weight, not the crop weightPerLiter; m³-based (÷1000)
    expect(res.yieldTons).toBeCloseTo((expectedLiters / 1000) * constants.silageWeight, 6)
  })

  it('corn silage differs from corn grain (chaff factor 7.8)', () => {
    const sil = cropProjection(corn, { hectares: 5, isSilage: true }, normalFarm, catalog)
    const grain = cropProjection(corn, { hectares: 5, isSilage: false }, normalFarm, catalog)
    expect(sil.isSilage).toBe(true)
    expect(grain.isSilage).toBe(false)
    // silage chopped yield is yield*chaff -> much larger liters
    expect(sil.yieldLiters).toBeGreaterThan(grain.yieldLiters)
  })

  it('falls back to normal path when no silage crop exists for the slug', () => {
    // grass HAS a silage entry; potato does NOT — but potato is not in crops list
    // for silage, so use a crop without silage: 'potato'.
    const res = cropProjection(
      catalog.crops.find((c) => c.slug === 'potato')!,
      { hectares: 5, isSilage: true },
      normalFarm,
      catalog,
    )
    expect(res.isSilage).toBe(false)
    expect(res.pricePerLiter).toBe(0.222)
  })
})

describe('compareCrops', () => {
  it('returns one projection per crop on the same area', () => {
    const rows = compareCrops(crops, 10, normalFarm, catalog)
    expect(rows).toHaveLength(crops.length)
    for (const row of rows) {
      expect(row.areaM2).toBe(100000)
      expect(row.grossIncome).toBeGreaterThan(0)
    }
  })

  it('grass yields more liters but less income than poplar at same area', () => {
    const rows = compareCrops([grass, poplar], 10, normalFarm, catalog)
    const g = rows.find((r) => r.slug === 'grass')!
    const p = rows.find((r) => r.slug === 'poplar')!
    expect(p.grossIncome).toBeGreaterThan(g.grossIncome)
  })
})
