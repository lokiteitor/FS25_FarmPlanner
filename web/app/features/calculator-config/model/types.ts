// features/calculator-config/model/types — the persisted calculator config for
// one animal species. Mirrors the `AnimalConfig` / `AnimalConfigInputs`
// (CowInputs..HorseInputs) schemas in docs/openapi.yaml.
//
// These inputs are a SUPERSET of the engine's `AnimalInputs` (shared/lib/engine):
// they additionally carry `linkedStableId` (the "vincular establo" link) and the
// cow-only `breed`. Difficulty / sellPriceType are NOT here — they live on the
// farm (FarmContext). The engine reads the relevant subset.

import type { AnimalSpecies } from '~/entities/catalog'

export type { AnimalSpecies }

/** Ruminant feed type. Buffalo excludes `simple` (openapi BuffaloInputs). */
export type FeedType = 'tmr' | 'simple' | 'hay' | 'grass'

/** Cow breed (openapi CowInputs). */
export type CowBreed = 'Holstein' | 'Other'

/** Chicken bought-feed slug (openapi ChickenInputs). */
export type BoughtFeedType = 'oat' | 'wheat'

/** Fields common to every species' inputs (openapi: species/count/yieldBonus/linkedStableId). */
export interface BaseAnimalInputs {
  species: AnimalSpecies
  /** Head count (integer, ≥ 0). */
  count: number
  /** Per-config yield-bonus override (0..5); falls back to farm.defaultYieldBonus. */
  yieldBonus?: number
  /** Linked stable id ("vincular establo"), or null. */
  linkedStableId?: string | null
}

export interface CowInputs extends BaseAnimalInputs {
  species: 'cow'
  feedType?: FeedType
  provideStraw?: boolean
  grassHarvests?: number
  silageCrop?: string | null
  sellCount?: number
  breed?: CowBreed
}

export interface BuffaloInputs extends BaseAnimalInputs {
  species: 'buffalo'
  /** Buffalo has no `simple` feed type. */
  feedType?: Exclude<FeedType, 'simple'>
  provideStraw?: boolean
  grassHarvests?: number
  silageCrop?: string | null
  sellCount?: number
}

export interface ChickenInputs extends BaseAnimalInputs {
  species: 'chicken'
  boughtFeedPercent?: number
  boughtFeedType?: BoughtFeedType
  grownCrop?: string
}

export interface SheepInputs extends BaseAnimalInputs {
  species: 'sheep'
  grassHarvests?: number
  sellCount?: number
}

export interface GoatInputs extends BaseAnimalInputs {
  species: 'goat'
  grassHarvests?: number
  sellCount?: number
}

export interface PigInputs extends BaseAnimalInputs {
  species: 'pig'
  provideStraw?: boolean
  sellCount?: number
  baseCrop?: string
  grainCrop?: string
  proteinCrop?: string
  rootCrop?: string
}

export interface HorseInputs extends BaseAnimalInputs {
  species: 'horse'
  provideStraw?: boolean
  grassHarvests?: number
  sellCount?: number
  baseCrop?: string
  rootCrop?: string
}

/** Discriminated union of all species' inputs (openapi AnimalConfigInputs). */
export type AnimalConfigInputs =
  | CowInputs
  | BuffaloInputs
  | ChickenInputs
  | SheepInputs
  | GoatInputs
  | PigInputs
  | HorseInputs

/** A persisted calculator config row (openapi AnimalConfig). */
export interface AnimalConfig {
  id: string
  farmId: string
  species: AnimalSpecies
  schemaVersion: number
  inputs: AnimalConfigInputs
  createdAt?: string
  updatedAt?: string
}
