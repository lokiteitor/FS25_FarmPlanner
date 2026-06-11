// entities/catalog — public API of the catalog slice.
//
// Higher layers (app, pages, widgets, features) import ONLY from here; the
// internal model/api modules are private to the slice (FSD cross-slice rule).

export { useCatalogStore } from './model/catalog.store'

export * as catalogApi from './api/catalogApi'

export type {
  Catalog,
  GameVersion,
  Crop,
  SilageCrop,
  AnimalProduct,
  AnimalType,
  AnimalFeedOptions,
  AnimalFeedComponent,
  GameConstants,
  MilkPriceScalars,
  MilkPriceMonthly,
  DifficultyScalars,
  Difficulty,
  SellPriceType,
  AnimalSpecies,
} from './model/types'
