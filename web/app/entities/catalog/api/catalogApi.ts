// entities/catalog/api/catalogApi — typed wrappers over `shared/api` for the
// `/catalog/*` endpoints (docs/openapi.yaml, Catalog tag).
//
// FSD: entities may depend on `shared`. Components/features must go through the
// catalog store (model/catalog.store), never call these network functions
// directly (docs/arquitectura-frontend.md §8.1).
//
// Every endpoint accepts an optional `gameVersionId`; when omitted the backend
// resolves the active version (GameVersionQuery in docs/openapi.yaml). We send
// it as a query param only when provided so the request stays cacheable.

import { get, getData } from '~/shared/api'
import type {
  AnimalType,
  Crop,
  GameConstants,
  GameVersion,
  SilageCrop,
  ProductionBuildingType,
  ProductionProduct,
  ProductionChain,
} from '../model/types'

/** Build the `{ gameVersionId }` query, omitting it when undefined. */
function versionQuery(gameVersionId?: string) {
  return gameVersionId ? { gameVersionId } : undefined
}

/** GET /catalog/game-versions — list available game versions. */
export function getGameVersions(): Promise<GameVersion[]> {
  return getData<GameVersion[]>('/catalog/game-versions')
}

/** GET /catalog/crops — crops for the given (or active) version. */
export function getCrops(gameVersionId?: string): Promise<Crop[]> {
  return getData<Crop[]>('/catalog/crops', { query: versionQuery(gameVersionId) })
}

/** GET /catalog/silage-crops — silage crops for the given (or active) version. */
export function getSilageCrops(gameVersionId?: string): Promise<SilageCrop[]> {
  return getData<SilageCrop[]>('/catalog/silage-crops', { query: versionQuery(gameVersionId) })
}

/** GET /catalog/animal-types — animal types for the given (or active) version. */
export function getAnimalTypes(gameVersionId?: string): Promise<AnimalType[]> {
  return getData<AnimalType[]>('/catalog/animal-types', { query: versionQuery(gameVersionId) })
}

/**
 * GET /catalog/constants — global balance constants for the given (or active)
 * version. Uses the full envelope so the resolved `meta.gameVersionId` is
 * available to callers when needed.
 */
export async function getConstants(gameVersionId?: string): Promise<GameConstants> {
  const { data } = await get<GameConstants>('/catalog/constants', {
    query: versionQuery(gameVersionId),
  })
  return data
}

/** GET /catalog/production-building-types — building types for the given (or active) version. */
export function getProductionBuildingTypes(gameVersionId?: string): Promise<ProductionBuildingType[]> {
  return getData<ProductionBuildingType[]>('/catalog/production-building-types', {
    query: versionQuery(gameVersionId),
  })
}

/** GET /catalog/production-products — manufactured products for the given (or active) version. */
export function getProductionProducts(gameVersionId?: string): Promise<ProductionProduct[]> {
  return getData<ProductionProduct[]>('/catalog/production-products', {
    query: versionQuery(gameVersionId),
  })
}

/** GET /catalog/production-chains — production chain recipes for the given (or active) version. */
export function getProductionChains(gameVersionId?: string): Promise<ProductionChain[]> {
  return getData<ProductionChain[]>('/catalog/production-chains', {
    query: versionQuery(gameVersionId),
  })
}
