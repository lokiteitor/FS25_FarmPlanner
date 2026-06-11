// entities/stable/model/types — domain shapes for a stable ("establo").
// Mirrors the `Stable` / `StableCreate` / `StableUpdate` schemas in
// docs/openapi.yaml (nested under /farms/:farmId/stables).
//
// `AnimalSpecies` is a shared catalog/domain primitive; we re-use
// entities/catalog's public API (cross-slice via its index.ts, FSD-OK).

import type { AnimalSpecies } from '~/entities/catalog'

export type { AnimalSpecies }

/**
 * Per-stable calculator overrides, validated server-side with zod by `species`
 * (see Stable.config in openapi.yaml). The shape is heterogeneous and open
 * (`additionalProperties: true`); known keys are documented here for editor
 * help, but any key is accepted. Values are crop slugs, feed types or flags.
 * Difficulty / sellPriceType are NOT here (they live on the farm).
 */
export interface StableConfig {
  /** Ruminants: feed type. */
  feedType?: string
  /** Provide straw bonus (cow/buffalo/pig/horse). */
  provideStraw?: boolean
  /** Hay/grass fieldwork: grass harvests per year. */
  grassHarvests?: number
  /** Ruminants: silage crop slug. */
  silageCrop?: string | null
  /** Pig/horse feed component crop slugs. */
  baseCrop?: string
  grainCrop?: string
  proteinCrop?: string
  rootCrop?: string
  /** Open shape: any additional zod-validated key. */
  [key: string]: unknown
}

/** A stable belonging to a farm (Stable schema). */
export interface Stable {
  id: string
  farmId: string
  name: string
  species: AnimalSpecies
  /** Maximum animals the stable can hold. */
  maxCapacity: number
  /** Current head count (≤ maxCapacity). */
  currentCount: number
  config: StableConfig
  createdAt?: string
  updatedAt?: string
}

/** Body for `POST /farms/:farmId/stables` (StableCreate). */
export interface StableCreate {
  name: string
  species: AnimalSpecies
  maxCapacity: number
  /** Defaults to 0 on the backend. */
  currentCount?: number
  config?: StableConfig
}

/** Body for `PATCH /farms/:farmId/stables/:id` (StableUpdate). All optional. */
export interface StableUpdate {
  name?: string
  species?: AnimalSpecies
  maxCapacity?: number
  currentCount?: number
  config?: StableConfig
}
