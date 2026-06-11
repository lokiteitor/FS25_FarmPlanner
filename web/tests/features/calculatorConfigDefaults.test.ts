// tests/features/calculatorConfigDefaults — unit tests for the PURE default-
// inputs builder of the calculator-config feature. Asserts each species gets a
// well-formed inputs object whose feed/crop selections come from the catalog.

// Deep-import the pure model modules to avoid pulling the feature barrel, which
// re-exports a .vue component (vitest here has no Vue SFC plugin).
import { describe, expect, it } from 'vitest'
import { defaultInputsFor } from '~/features/calculator-config/model/defaults'
import type { AnimalConfigInputs } from '~/features/calculator-config/model/types'
import type { Catalog } from '~/entities/catalog'
import { catalog as engineCatalog } from '../engine/fixtures'

// The engine fixture catalog is structurally compatible with entities/catalog's
// `Catalog` for the fields the defaults builder reads (animalTypes.feedOptions,
// crops). Cast through unknown for the test.
const catalog = engineCatalog as unknown as Catalog

describe('defaultInputsFor', () => {
  it('cow: defaults to TMR, straw on, first silage crop, and Holstein breed', () => {
    const i = defaultInputsFor('cow', catalog) as Extract<AnimalConfigInputs, { species: 'cow' }>
    expect(i.species).toBe('cow')
    expect(i.count).toBe(0)
    expect(i.feedType).toBe('tmr')
    expect(i.provideStraw).toBe(true)
    expect(i.breed).toBe('Holstein')
    // First admissible silage crop from the catalog (cow feedOptions.silageCrops[0]).
    expect(i.silageCrop).toBe('corn')
    expect(i.linkedStableId).toBeNull()
  })

  it('buffalo: never selects the simple feed type', () => {
    const i = defaultInputsFor('buffalo', catalog) as Extract<
      AnimalConfigInputs,
      { species: 'buffalo' }
    >
    expect(i.species).toBe('buffalo')
    expect(i.feedType).not.toBe('simple')
    expect(i.feedType).toBe('tmr')
  })

  it('chicken: picks the first bought feed + first grown crop from the catalog', () => {
    const i = defaultInputsFor('chicken', catalog) as Extract<
      AnimalConfigInputs,
      { species: 'chicken' }
    >
    expect(i.boughtFeedPercent).toBe(0)
    expect(i.boughtFeedType).toBe('oat') // chicken.feedOptions.boughtFeedTypes[0]
    expect(i.grownCrop).toBe('barley') // chicken.feedOptions.fieldworkCrops[0]
  })

  it('pig: selects one crop per feed component from the catalog', () => {
    const i = defaultInputsFor('pig', catalog) as Extract<AnimalConfigInputs, { species: 'pig' }>
    expect(i.baseCrop).toBe('corn')
    expect(i.grainCrop).toBe('wheat')
    expect(i.proteinCrop).toBe('soybean')
    expect(i.rootCrop).toBe('potato')
    expect(i.provideStraw).toBe(true)
  })

  it('horse: selects base + root crops (no grain/protein component)', () => {
    const i = defaultInputsFor('horse', catalog) as Extract<
      AnimalConfigInputs,
      { species: 'horse' }
    >
    expect(i.baseCrop).toBe('oat')
    expect(i.rootCrop).toBe('potato')
    expect(i).not.toHaveProperty('grainCrop')
  })

  it('sheep & goat: grass-fed, sellable, no straw/feed crops', () => {
    const sheep = defaultInputsFor('sheep', catalog)
    const goat = defaultInputsFor('goat', catalog)
    expect(sheep.species).toBe('sheep')
    expect(goat.species).toBe('goat')
    expect(sheep).not.toHaveProperty('feedType')
    expect(goat).not.toHaveProperty('provideStraw')
    expect((sheep as { sellCount?: number }).sellCount).toBe(0)
    expect((goat as { sellCount?: number }).sellCount).toBe(0)
  })

  it('every species default carries species, count and linkedStableId', () => {
    const all: AnimalConfigInputs['species'][] = [
      'cow',
      'buffalo',
      'chicken',
      'sheep',
      'goat',
      'pig',
      'horse',
    ]
    for (const species of all) {
      const i = defaultInputsFor(species, catalog)
      expect(i.species).toBe(species)
      expect(i.count).toBe(0)
      expect(i.linkedStableId).toBeNull()
    }
  })
})
