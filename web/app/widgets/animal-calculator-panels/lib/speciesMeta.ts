// widgets/animal-calculator-panels/lib/speciesMeta — per-species presentation
// metadata for the calculator panels: which inputs are visible, their Spanish
// labels, and how to translate engine rate keys / feed components into Spanish.
//
// This is PURE presentation config (no stores, no network). The numeric model
// lives in shared/lib/engine; this file only decides what the form shows.

import type { AnimalSpecies } from '~/entities/catalog'

/** Toggle flags controlling which inputs a species' Inputs panel renders. */
export interface SpeciesFieldVisibility {
  /** Ruminant feed-type select (cow/buffalo). */
  feedType: boolean
  /** Whether the species can use the `simple` feed type (cow only). */
  feedTypeSimple: boolean
  /** "Proveer paja" toggle (cow/buffalo/pig/horse). */
  provideStraw: boolean
  /** Cosechas de hierba/año (ruminants + sheep/goat/horse). */
  grassHarvests: boolean
  /** Silage crop select (cow/buffalo). */
  silageCrop: boolean
  /** Animals sold/year (all but chicken). */
  sellCount: boolean
  /** Cow breed select. */
  breed: boolean
  /** Chicken bought-feed inputs. */
  chickenFeed: boolean
  /** Pig/horse base feed crop. */
  baseCrop: boolean
  /** Pig grain crop. */
  grainCrop: boolean
  /** Pig protein crop. */
  proteinCrop: boolean
  /** Pig/horse root crop. */
  rootCrop: boolean
}

/** Per-species metadata used by the panels. */
export interface SpeciesMeta {
  species: AnimalSpecies
  /** Spanish plural label (matches catalog name_es). */
  labelEs: string
  /** Route segment under /animals (matches the sidebar links from H6). */
  route: string
  visibility: SpeciesFieldVisibility
}

function visibility(overrides: Partial<SpeciesFieldVisibility>): SpeciesFieldVisibility {
  return {
    feedType: false,
    feedTypeSimple: false,
    provideStraw: false,
    grassHarvests: false,
    silageCrop: false,
    sellCount: false,
    breed: false,
    chickenFeed: false,
    baseCrop: false,
    grainCrop: false,
    proteinCrop: false,
    rootCrop: false,
    ...overrides,
  }
}

export const SPECIES_META: Record<AnimalSpecies, SpeciesMeta> = {
  cow: {
    species: 'cow',
    labelEs: 'Vacas',
    route: 'cows',
    visibility: visibility({
      feedType: true,
      feedTypeSimple: true,
      provideStraw: true,
      grassHarvests: true,
      silageCrop: true,
      sellCount: true,
      breed: true,
    }),
  },
  buffalo: {
    species: 'buffalo',
    labelEs: 'Búfalos',
    route: 'buffalo',
    visibility: visibility({
      feedType: true,
      feedTypeSimple: false,
      provideStraw: true,
      grassHarvests: true,
      silageCrop: true,
      sellCount: true,
    }),
  },
  chicken: {
    species: 'chicken',
    labelEs: 'Gallinas',
    route: 'chickens',
    visibility: visibility({ chickenFeed: true }),
  },
  sheep: {
    species: 'sheep',
    labelEs: 'Ovejas',
    route: 'sheep',
    visibility: visibility({ grassHarvests: true, sellCount: true }),
  },
  goat: {
    species: 'goat',
    labelEs: 'Cabras',
    route: 'goats',
    visibility: visibility({ grassHarvests: true, sellCount: true }),
  },
  pig: {
    species: 'pig',
    labelEs: 'Cerdos',
    route: 'pigs',
    visibility: visibility({
      provideStraw: true,
      sellCount: true,
      baseCrop: true,
      grainCrop: true,
      proteinCrop: true,
      rootCrop: true,
    }),
  },
  horse: {
    species: 'horse',
    labelEs: 'Caballos',
    route: 'horses',
    visibility: visibility({
      provideStraw: true,
      grassHarvests: true,
      sellCount: true,
      baseCrop: true,
      rootCrop: true,
    }),
  },
}

/** Spanish labels for engine rate keys (production + consumption + product slugs). */
const RATE_LABELS_ES: Record<string, string> = {
  milk: 'Leche',
  goat_milk: 'Leche de cabra',
  buffalo_milk: 'Leche de búfala',
  eggs: 'Huevos',
  wool: 'Lana',
  slurry: 'Purín',
  manure: 'Estiércol',
  food: 'Comida',
  straw: 'Paja',
  hay: 'Heno',
}

/** Translate an engine rate / requirement key into a Spanish label. */
export function rateLabelEs(key: string): string {
  return RATE_LABELS_ES[key] ?? key
}

/** Spanish labels for ruminant feed types. */
export const FEED_TYPE_LABELS_ES: Record<string, string> = {
  tmr: 'TMR (ración mixta)',
  simple: 'Mezcla simple',
  hay: 'Heno',
  grass: 'Hierba',
}

/** Spanish labels for pig/horse feed components. */
export const FEED_COMPONENT_LABELS_ES: Record<string, string> = {
  base: 'Base',
  grain: 'Grano',
  protein: 'Proteína',
  root: 'Raíces',
  hay: 'Heno',
}

/** Cow breed options (openapi CowInputs.breed). */
export const COW_BREED_LABELS_ES: Record<string, string> = {
  Holstein: 'Holstein',
  Other: 'Otra',
}
