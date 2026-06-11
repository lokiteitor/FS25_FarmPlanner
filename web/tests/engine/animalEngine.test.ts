// tests/engine/animalEngine — internal-consistency tests for the animal engine.
// Assert documented relationships, NOT byte-parity with the prototype.

import { describe, expect, it } from 'vitest'
import {
  animalProjection,
  computeProductPrice,
  feedProductivityFactor,
  strawBonusFactor,
} from '~/shared/lib/engine'
import type { AnimalInputs } from '~/shared/lib/engine'
import {
  catalog,
  constants,
  cow,
  chicken,
  buffalo,
  goat,
  easyFarm,
  hardFarm,
  normalFarm,
  maxSeasonalFarm,
  sheep,
} from './fixtures'

describe('feedProductivityFactor (ruminant ordering tmr > hay > grass)', () => {
  it('cow: tmr 1.0, hay 0.8, grass 0.4', () => {
    expect(feedProductivityFactor(cow, 'tmr')).toBe(1.0)
    expect(feedProductivityFactor(cow, 'hay')).toBe(0.8)
    expect(feedProductivityFactor(cow, 'grass')).toBe(0.4)
  })
  it('non-ruminant (sheep) has no productivity factors -> 1', () => {
    expect(feedProductivityFactor(sheep, undefined)).toBe(1)
  })
})

describe('strawBonusFactor', () => {
  it('1 without straw, 1 + strawBonus with straw', () => {
    expect(strawBonusFactor(false, constants)).toBe(1)
    expect(strawBonusFactor(true, constants)).toBeCloseTo(1 + 0.11111111, 10)
  })
})

describe('cow milk production scales tmr > hay > grass', () => {
  const base: AnimalInputs = { species: 'cow', count: 10, yieldBonus: 0 }
  const tmr = animalProjection({ ...base, feedType: 'tmr' }, normalFarm, catalog)
  const hay = animalProjection({ ...base, feedType: 'hay' }, normalFarm, catalog)
  const grass = animalProjection({ ...base, feedType: 'grass' }, normalFarm, catalog)

  it('tmr > hay > grass for product liters', () => {
    expect(tmr.production.productLitersPerYear).toBeGreaterThan(hay.production.productLitersPerYear)
    expect(hay.production.productLitersPerYear).toBeGreaterThan(grass.production.productLitersPerYear)
  })

  it('hay == 0.8 * tmr, grass == 0.4 * tmr', () => {
    expect(hay.production.productLitersPerYear).toBeCloseTo(0.8 * tmr.production.productLitersPerYear, 4)
    expect(grass.production.productLitersPerYear).toBeCloseTo(0.4 * tmr.production.productLitersPerYear, 4)
  })

  it('tmr milk/year = rate * 12 * count * (1 + bonus) at bonus 0', () => {
    // 135 milk/month * 12 * 10 head * 1.0 factor = 16200
    expect(tmr.production.productLitersPerYear).toBeCloseTo(135 * 12 * 10, 4)
  })
})

describe('provideStraw raises output by ~strawBonus', () => {
  const base: AnimalInputs = { species: 'cow', count: 10, yieldBonus: 0, feedType: 'tmr' }
  const without = animalProjection({ ...base, provideStraw: false }, normalFarm, catalog)
  const withStraw = animalProjection({ ...base, provideStraw: true }, normalFarm, catalog)

  it('milk/year ratio == 1 + strawBonus', () => {
    const ratio = withStraw.production.productLitersPerYear / without.production.productLitersPerYear
    expect(ratio).toBeCloseTo(1 + 0.11111111, 8)
  })
})

describe('production is NOT scaled by yield bonus (prototype parity)', () => {
  // RECONCILE: the prototype does NOT apply (1 + yieldBonus) to animal
  // PRODUCTION (only fieldwork hectares use the bonus). productionFactor is
  // still REPORTED as 1 + bonus, but it no longer multiplies production.
  it('milk/year is identical at bonus 0 vs 0.425; productionFactor still reports 1.425', () => {
    const noBonus = animalProjection({ species: 'cow', count: 5, yieldBonus: 0, feedType: 'tmr' }, normalFarm, catalog)
    const def = animalProjection({ species: 'cow', count: 5, yieldBonus: 0.425, feedType: 'tmr' }, normalFarm, catalog)
    expect(def.production.productLitersPerYear).toBeCloseTo(noBonus.production.productLitersPerYear, 8)
    // The reported factor is unchanged (1 + default bonus == yield_bonus_scalar).
    expect(def.productionFactor).toBeCloseTo(1.425, 10)
    expect(def.productionFactor).toBeCloseTo(constants.yieldBonusScalar, 10)
  })
})

describe('difficulty scales product revenue (easy == 3 * hard)', () => {
  const base: AnimalInputs = { species: 'cow', count: 10, yieldBonus: 0.425, feedType: 'tmr' }
  it('easy productRevenue == 3 * hard, normal == 1.8 * hard', () => {
    const easy = animalProjection(base, easyFarm, catalog)
    const normal = animalProjection(base, normalFarm, catalog)
    const hard = animalProjection(base, hardFarm, catalog)
    expect(easy.economics.productRevenue).toBeCloseTo(3 * hard.economics.productRevenue, 4)
    expect(normal.economics.productRevenue).toBeCloseTo(1.8 * hard.economics.productRevenue, 4)
  })
})

describe('cow milk price uses milkPriceScalars', () => {
  it('baseline uses average, max_seasonal uses max', () => {
    expect(computeProductPrice(cow, normalFarm, constants)).toBeCloseTo(0.7 * constants.milkPriceScalars.average, 10)
    expect(computeProductPrice(cow, maxSeasonalFarm, constants)).toBeCloseTo(0.7 * constants.milkPriceScalars.max, 10)
  })
  it('max_seasonal product revenue > baseline (peak month price)', () => {
    const base = animalProjection({ species: 'cow', count: 10, yieldBonus: 0.425, feedType: 'tmr' }, normalFarm, catalog)
    const max = animalProjection({ species: 'cow', count: 10, yieldBonus: 0.425, feedType: 'tmr' }, maxSeasonalFarm, catalog)
    expect(max.economics.productRevenue).toBeGreaterThan(base.economics.productRevenue)
  })
})

describe('scaled products use product.priceScalar', () => {
  it('chicken eggs price = basePrice * 1.25', () => {
    expect(computeProductPrice(chicken, normalFarm, constants)).toBeCloseTo(1.12 * 1.25, 10)
  })
  it('sheep wool price = basePrice * 1.29', () => {
    expect(computeProductPrice(sheep, normalFarm, constants)).toBeCloseTo(0.94 * 1.29, 10)
  })
  it('goat milk price = basePrice * 1.08', () => {
    const goat = catalog.animalTypes.find((a) => a.species === 'goat')!
    expect(computeProductPrice(goat, normalFarm, constants)).toBeCloseTo(2.82 * 1.08, 10)
  })
})

describe('sellCount * salePrice in salesRevenue (NOT difficulty scaled)', () => {
  it('cow sale: sellCount * 3500', () => {
    const res = animalProjection(
      { species: 'cow', count: 10, yieldBonus: 0, feedType: 'tmr', sellCount: 4 },
      normalFarm,
      catalog,
    )
    expect(res.economics.salesRevenue).toBe(4 * 3500)
  })
  it('sale revenue identical across difficulties (no scaling)', () => {
    const easy = animalProjection({ species: 'cow', count: 10, sellCount: 4, feedType: 'tmr' }, easyFarm, catalog)
    const hard = animalProjection({ species: 'cow', count: 10, sellCount: 4, feedType: 'tmr' }, hardFarm, catalog)
    expect(easy.economics.salesRevenue).toBe(hard.economics.salesRevenue)
  })
  it('sheep/goat are sellable (salePrice 1000)', () => {
    const res = animalProjection({ species: 'sheep', count: 20, sellCount: 5 }, normalFarm, catalog)
    expect(res.economics.salesRevenue).toBe(5 * 1000)
  })
  it('chicken has no salePrice -> 0', () => {
    const res = animalProjection({ species: 'chicken', count: 100, sellCount: 10 }, normalFarm, catalog)
    expect(res.economics.salesRevenue).toBe(0)
  })
})

describe('consumption is annualized magnitude, not scaled by bonus', () => {
  it('cow food consumption = 350 * 12 * count regardless of bonus/straw', () => {
    const a = animalProjection({ species: 'cow', count: 10, yieldBonus: 0, feedType: 'tmr', provideStraw: true }, normalFarm, catalog)
    const b = animalProjection({ species: 'cow', count: 10, yieldBonus: 1, feedType: 'grass', provideStraw: false }, normalFarm, catalog)
    expect(a.consumption.byKey.food.perYear).toBeCloseTo(350 * 12 * 10, 4)
    expect(b.consumption.byKey.food.perYear).toBeCloseTo(350 * 12 * 10, 4)
  })
})

describe('fieldwork breakdown', () => {
  it('chicken bought feed is costed via feed_purchase_prices', () => {
    const res = animalProjection(
      { species: 'chicken', count: 100, boughtFeedPercent: 50, boughtFeedType: 'wheat', grownCrop: 'wheat' },
      normalFarm,
      catalog,
    )
    const bought = res.fieldwork.requirements.find((r) => r.key.startsWith('feed:'))!
    // food consumption = 5 * 12 * 100 = 6000 L/yr; 50% bought = 3000 L * 1.5
    expect(bought.litersPerYear).toBeCloseTo(3000, 4)
    expect(bought.costPerYear).toBeCloseTo(3000 * 1.5, 4)
    expect(res.economics.feedCost).toBeGreaterThan(0)
  })

  it('cow TMR ration includes mineral feed cost and silage hectares', () => {
    const res = animalProjection(
      { species: 'cow', count: 10, feedType: 'tmr', silageCrop: 'corn' },
      normalFarm,
      catalog,
    )
    const mineral = res.fieldwork.requirements.find((r) => r.key === 'mineralFeed')!
    const silage = res.fieldwork.requirements.find((r) => r.key === 'silage:corn')!
    expect(mineral.costPerYear).toBeGreaterThan(0)
    expect(silage.hectaresNeeded).toBeGreaterThan(0)
    expect(res.fieldwork.totalHectaresNeeded).toBeGreaterThan(0)
  })

  it('pig per-component feed maps to chosen crops with hectares', () => {
    const res = animalProjection(
      { species: 'pig', count: 50, baseCrop: 'corn', grainCrop: 'wheat', proteinCrop: 'soybean', rootCrop: 'potato' },
      normalFarm,
      catalog,
    )
    const base = res.fieldwork.requirements.find((r) => r.key.startsWith('feed:base'))!
    // base: 30 L/animal/month * 12 * 50 = 18000 L/yr
    expect(base.litersPerYear).toBeCloseTo(30 * 12 * 50, 4)
    expect(base.hectaresNeeded).toBeGreaterThan(0)
  })

  it('horse hay component maps to grass yield, base/root to crops', () => {
    const res = animalProjection(
      { species: 'horse', count: 8, baseCrop: 'oat', rootCrop: 'potato', provideStraw: true },
      normalFarm,
      catalog,
    )
    const hay = res.fieldwork.requirements.find((r) => r.key === 'hay')!
    expect(hay.litersPerYear).toBeCloseTo(285.75 * 12 * 8, 4)
    expect(hay.hectaresNeeded).toBeGreaterThan(0)
    // RECONCILE: the prototype's horse fieldwork breakdown is base/hay/root only
    // (no straw-bedding hectares), so the horse projection has NO straw
    // requirement even when provideStraw is true. Straw is still surfaced as a
    // CONSUMPTION line (production panel), gated on provideStraw.
    expect(res.fieldwork.requirements.some((r) => r.slug === 'straw')).toBe(false)
    expect(res.consumption.byKey.straw?.perYear).toBeCloseTo(80 * 12 * 8, 4)
  })
})

describe('production byKey includes slurry/manure (non-product positive rates)', () => {
  it('cow slurry always present; manure gated on provideStraw (prototype parity)', () => {
    // slurry is produced regardless of straw; manure (and straw bedding) only
    // when straw is provided. NO factors/bonus on residues.
    const withStraw = animalProjection(
      { species: 'cow', count: 10, yieldBonus: 0, feedType: 'tmr', provideStraw: true },
      normalFarm,
      catalog,
    )
    expect(withStraw.production.byKey.slurry.perYear).toBeCloseTo(250 * 12 * 10, 4)
    expect(withStraw.production.byKey.manure.perYear).toBeCloseTo(200 * 12 * 10, 4)

    const noStraw = animalProjection(
      { species: 'cow', count: 10, yieldBonus: 0, feedType: 'tmr', provideStraw: false },
      normalFarm,
      catalog,
    )
    expect(noStraw.production.byKey.slurry.perYear).toBeCloseTo(250 * 12 * 10, 4)
    expect(noStraw.production.byKey.manure.perYear).toBe(0)
  })
})

describe('animalProjection throws on unknown species', () => {
  it('rejects a species not in the catalog', () => {
    const badCatalog = { ...catalog, animalTypes: [] }
    expect(() => animalProjection({ species: 'cow', count: 1 }, normalFarm, badCatalog)).toThrow()
  })
})

describe('milk-type product key resolution (regression: buffalo/goat revenue)', () => {
  it('buffalo & goat have non-zero product liters and revenue (slug *_milk -> rate key "milk")', () => {
    const buf = animalProjection({ species: 'buffalo', count: 10 } as AnimalInputs, normalFarm, catalog)
    expect(buf.production.productLitersPerYear).toBeGreaterThan(0)
    expect(buf.economics.productRevenue).toBeGreaterThan(0)

    const g = animalProjection({ species: 'goat', count: 10 } as AnimalInputs, normalFarm, catalog)
    expect(g.production.productLitersPerYear).toBeGreaterThan(0)
    expect(g.economics.productRevenue).toBeGreaterThan(0)
  })

  it('cow/chicken/sheep product revenue still positive (no regression)', () => {
    for (const sp of ['cow', 'chicken', 'sheep'] as const) {
      const r = animalProjection({ species: sp, count: 10 } as AnimalInputs, normalFarm, catalog)
      expect(r.economics.productRevenue).toBeGreaterThan(0)
    }
  })
})
