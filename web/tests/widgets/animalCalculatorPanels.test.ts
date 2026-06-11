// tests/widgets/animalCalculatorPanels — unit tests for the PURE bridge logic of
// the animal-calculator-panels widget: toEngineInputs (config -> engine inputs)
// and the per-species presentation metadata (SPECIES_META, rateLabelEs).

// Deep-import the pure model/lib modules to avoid the widget barrel, which
// re-exports .vue components (vitest here has no Vue SFC plugin).
import { describe, expect, it } from 'vitest'
import { toEngineInputs } from '~/widgets/animal-calculator-panels/model/useAnimalProjection'
import {
  SPECIES_META,
  rateLabelEs,
} from '~/widgets/animal-calculator-panels/lib/speciesMeta'
import { animalProjection } from '~/shared/lib/engine'
import type { EngineCatalog } from '~/shared/lib/engine'
import type { AnimalConfigInputs } from '~/features/calculator-config/model/types'
import { catalog as engineCatalog, normalFarm } from '../engine/fixtures'

const catalog = engineCatalog as unknown as EngineCatalog

describe('toEngineInputs', () => {
  it('strips linkedStableId/breed and forwards the engine-relevant fields', () => {
    const config: AnimalConfigInputs = {
      species: 'cow',
      count: 10,
      yieldBonus: 0.5,
      linkedStableId: 'stable-123',
      feedType: 'hay',
      provideStraw: true,
      silageCrop: 'corn',
      sellCount: 2,
      breed: 'Holstein',
    }
    const engine = toEngineInputs(config)
    expect(engine).not.toHaveProperty('linkedStableId')
    expect(engine).not.toHaveProperty('breed')
    expect(engine.species).toBe('cow')
    expect(engine.count).toBe(10)
    expect(engine.yieldBonus).toBe(0.5)
    expect(engine.feedType).toBe('hay')
    expect(engine.provideStraw).toBe(true)
    expect(engine.silageCrop).toBe('corn')
    expect(engine.sellCount).toBe(2)
  })

  it('maps an absent yieldBonus to null so the engine uses the farm default', () => {
    const config: AnimalConfigInputs = { species: 'goat', count: 5 }
    const engine = toEngineInputs(config)
    expect(engine.yieldBonus).toBeNull()

    // With null bonus the engine falls back to farm.defaultYieldBonus (0.425).
    const projection = animalProjection(engine, normalFarm, catalog)
    expect(projection.effectiveYieldBonus).toBeCloseTo(normalFarm.defaultYieldBonus, 10)
    expect(projection.productionFactor).toBeCloseTo(1 + normalFarm.defaultYieldBonus, 10)
  })

  it('coerces missing numeric fields to safe defaults (count 0, sellCount 0)', () => {
    const config = { species: 'pig' } as unknown as AnimalConfigInputs
    const engine = toEngineInputs(config)
    expect(engine.count).toBe(0)
    expect(engine.sellCount).toBe(0)
  })

  it('round-trips through the engine for a configured chicken flock', () => {
    const config: AnimalConfigInputs = {
      species: 'chicken',
      count: 100,
      boughtFeedPercent: 50,
      boughtFeedType: 'oat',
      grownCrop: 'wheat',
    }
    const p = animalProjection(toEngineInputs(config), normalFarm, catalog)
    // Eggs are produced; food is consumed; half of the food is bought (has a cost).
    expect(p.production.productSlug).toBe('eggs')
    expect(p.production.productLitersPerYear).toBeGreaterThan(0)
    expect(p.economics.feedCost).toBeGreaterThan(0)
    expect(p.fieldwork.requirements.some((r) => r.key.startsWith('grown:'))).toBe(true)
  })
})

describe('SPECIES_META', () => {
  it('exposes a metadata entry for all 7 species with the H6 sidebar routes', () => {
    expect(SPECIES_META.cow.route).toBe('cows')
    expect(SPECIES_META.buffalo.route).toBe('buffalo')
    expect(SPECIES_META.chicken.route).toBe('chickens')
    expect(SPECIES_META.sheep.route).toBe('sheep')
    expect(SPECIES_META.goat.route).toBe('goats')
    expect(SPECIES_META.pig.route).toBe('pigs')
    expect(SPECIES_META.horse.route).toBe('horses')
  })

  it('buffalo cannot use the simple feed type (visibility.feedTypeSimple = false)', () => {
    expect(SPECIES_META.buffalo.visibility.feedType).toBe(true)
    expect(SPECIES_META.buffalo.visibility.feedTypeSimple).toBe(false)
    expect(SPECIES_META.cow.visibility.feedTypeSimple).toBe(true)
  })

  it('only the breed field is shown for cows', () => {
    expect(SPECIES_META.cow.visibility.breed).toBe(true)
    for (const s of ['buffalo', 'chicken', 'sheep', 'goat', 'pig', 'horse'] as const) {
      expect(SPECIES_META[s].visibility.breed).toBe(false)
    }
  })

  it('chicken shows the chicken-feed inputs and no sale/straw inputs', () => {
    const v = SPECIES_META.chicken.visibility
    expect(v.chickenFeed).toBe(true)
    expect(v.sellCount).toBe(false)
    expect(v.provideStraw).toBe(false)
  })

  it('pig shows all four feed-component crop selects; horse shows base+root only', () => {
    const pig = SPECIES_META.pig.visibility
    expect([pig.baseCrop, pig.grainCrop, pig.proteinCrop, pig.rootCrop]).toEqual([
      true,
      true,
      true,
      true,
    ])
    const horse = SPECIES_META.horse.visibility
    expect(horse.baseCrop).toBe(true)
    expect(horse.rootCrop).toBe(true)
    expect(horse.grainCrop).toBe(false)
    expect(horse.proteinCrop).toBe(false)
  })
})

describe('rateLabelEs', () => {
  it('translates known engine rate keys to Spanish', () => {
    expect(rateLabelEs('milk')).toBe('Leche')
    expect(rateLabelEs('eggs')).toBe('Huevos')
    expect(rateLabelEs('wool')).toBe('Lana')
    expect(rateLabelEs('slurry')).toBe('Purín')
    expect(rateLabelEs('manure')).toBe('Estiércol')
    expect(rateLabelEs('food')).toBe('Comida')
    expect(rateLabelEs('straw')).toBe('Paja')
  })

  it('falls back to the raw key for unknown rates', () => {
    expect(rateLabelEs('unknown_rate')).toBe('unknown_rate')
  })
})
