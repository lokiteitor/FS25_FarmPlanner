// features/calculator-config/model/defaults — build a sane default
// `AnimalConfigInputs` for a species from the catalog. Used when no config has
// been saved yet (GET 404 -> catalog defaults) and to seed new forms.
//
// PURE: takes the catalog as an argument (no store/network). Defaults pick the
// first admissible crop slug from the animal type's feed options, and a neutral
// feed type / 0 sale count so projections are well-defined out of the box.

import type { Catalog, AnimalSpecies } from '~/entities/catalog'
import type {
  AnimalConfigInputs,
  BuffaloInputs,
  ChickenInputs,
  CowInputs,
  GoatInputs,
  HorseInputs,
  PigInputs,
  SheepInputs,
} from './types'

/** First crop slug of a feed component (pig/horse), or undefined. */
function firstComponentCrop(
  catalog: Catalog,
  species: AnimalSpecies,
  component: string,
): string | undefined {
  const at = catalog.animalTypes.find((a) => a.species === species)
  return at?.feedOptions.components?.[component]?.crops?.[0]
}

/** First admissible silage crop slug for a ruminant, or null. */
function firstSilageCrop(catalog: Catalog, species: AnimalSpecies): string | null {
  const at = catalog.animalTypes.find((a) => a.species === species)
  return at?.feedOptions.silageCrops?.[0] ?? null
}

/** First fieldwork crop for chicken (grown for the non-bought %), or undefined. */
function firstGrownCrop(catalog: Catalog, species: AnimalSpecies): string | undefined {
  const at = catalog.animalTypes.find((a) => a.species === species)
  return at?.feedOptions.fieldworkCrops?.[0]
}

/** First bought-feed slug for chicken, or undefined. */
function firstBoughtFeed(catalog: Catalog, species: AnimalSpecies): string | undefined {
  const at = catalog.animalTypes.find((a) => a.species === species)
  return at?.feedOptions.boughtFeedTypes?.[0]
}

/**
 * Build default inputs for `species` from `catalog`. The `count` defaults to 0
 * so a fresh calculator starts empty until the user enters a herd size.
 */
export function defaultInputsFor(
  species: AnimalSpecies,
  catalog: Catalog,
): AnimalConfigInputs {
  switch (species) {
    case 'cow': {
      const inputs: CowInputs = {
        species: 'cow',
        count: 0,
        linkedStableId: null,
        feedType: 'tmr',
        provideStraw: true,
        grassHarvests: 2,
        silageCrop: firstSilageCrop(catalog, 'cow'),
        sellCount: 0,
        breed: 'Holstein',
      }
      return inputs
    }
    case 'buffalo': {
      const inputs: BuffaloInputs = {
        species: 'buffalo',
        count: 0,
        linkedStableId: null,
        feedType: 'tmr',
        provideStraw: true,
        grassHarvests: 2,
        silageCrop: firstSilageCrop(catalog, 'buffalo'),
        sellCount: 0,
      }
      return inputs
    }
    case 'chicken': {
      const inputs: ChickenInputs = {
        species: 'chicken',
        count: 0,
        linkedStableId: null,
        boughtFeedPercent: 0,
        boughtFeedType: (firstBoughtFeed(catalog, 'chicken') as ChickenInputs['boughtFeedType']) ?? 'wheat',
        grownCrop: firstGrownCrop(catalog, 'chicken'),
      }
      return inputs
    }
    case 'sheep': {
      const inputs: SheepInputs = {
        species: 'sheep',
        count: 0,
        linkedStableId: null,
        grassHarvests: 2,
        sellCount: 0,
      }
      return inputs
    }
    case 'goat': {
      const inputs: GoatInputs = {
        species: 'goat',
        count: 0,
        linkedStableId: null,
        grassHarvests: 2,
        sellCount: 0,
      }
      return inputs
    }
    case 'pig': {
      const inputs: PigInputs = {
        species: 'pig',
        count: 0,
        linkedStableId: null,
        provideStraw: true,
        sellCount: 0,
        baseCrop: firstComponentCrop(catalog, 'pig', 'base'),
        grainCrop: firstComponentCrop(catalog, 'pig', 'grain'),
        proteinCrop: firstComponentCrop(catalog, 'pig', 'protein'),
        rootCrop: firstComponentCrop(catalog, 'pig', 'root'),
      }
      return inputs
    }
    case 'horse': {
      const inputs: HorseInputs = {
        species: 'horse',
        count: 0,
        linkedStableId: null,
        provideStraw: true,
        grassHarvests: 2,
        sellCount: 0,
        baseCrop: firstComponentCrop(catalog, 'horse', 'base'),
        rootCrop: firstComponentCrop(catalog, 'horse', 'root'),
      }
      return inputs
    }
  }
}
