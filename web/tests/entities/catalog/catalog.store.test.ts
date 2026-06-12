// Unit tests for entities/catalog/model/catalog.store — the Pinia 'catalog'
// store. The store's job is to fetch the seven versioned catalog endpoints
// (crops, silage crops, animal types, constants, production building types,
// production products, production chains) ONCE per version key and memoize the
// assembled `Catalog`, so the engine/widgets can read it synchronously.
//
// We mock the network layer (entities/catalog/api/catalogApi) entirely — the
// store imports it as `import * as catalogApi from '../api/catalogApi'`, and
// vi.mock is hoisted + resolved by module path, so this intercepts it. The
// assertions focus on the memoization / single-flight contract; the concrete
// catalog contents are irrelevant here, so we use light fixtures cast to the
// store's types.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('~/entities/catalog/api/catalogApi', () => ({
  getGameVersions: vi.fn(),
  getCrops: vi.fn(),
  getSilageCrops: vi.fn(),
  getAnimalTypes: vi.fn(),
  getConstants: vi.fn(),
  getProductionBuildingTypes: vi.fn(),
  getProductionProducts: vi.fn(),
  getProductionChains: vi.fn(),
}))

import * as catalogApi from '~/entities/catalog/api/catalogApi'
import { useCatalogStore } from '~/entities/catalog'
import type { GameConstants, GameVersion } from '~/entities/catalog'

const mockApi = vi.mocked(catalogApi)

// Minimal constants stub — the store never inspects its fields.
const constants = {} as GameConstants

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  // Each catalog endpoint resolves to an empty (but valid) collection; the
  // assembled Catalog is what we assert memoization on.
  mockApi.getCrops.mockResolvedValue([])
  mockApi.getSilageCrops.mockResolvedValue([])
  mockApi.getAnimalTypes.mockResolvedValue([])
  mockApi.getConstants.mockResolvedValue(constants)
  mockApi.getProductionBuildingTypes.mockResolvedValue([])
  mockApi.getProductionProducts.mockResolvedValue([])
  mockApi.getProductionChains.mockResolvedValue([])
})

describe('load (memoization / single-flight)', () => {
  it('fetches all seven endpoints exactly once and caches the result', async () => {
    const store = useCatalogStore()

    const first = await store.load('v1')
    const second = await store.load('v1')

    // Memoized: the second call returns the cached catalog with NO second round
    // of fetches (the contract under test). We assert this via the fetch
    // call-counts rather than object identity because the store hands back a
    // Pinia reactive proxy, not the raw fetched object.
    expect(second).toStrictEqual(first)
    expect(mockApi.getCrops).toHaveBeenCalledTimes(1)
    expect(mockApi.getSilageCrops).toHaveBeenCalledTimes(1)
    expect(mockApi.getAnimalTypes).toHaveBeenCalledTimes(1)
    expect(mockApi.getConstants).toHaveBeenCalledTimes(1)
    expect(mockApi.getProductionBuildingTypes).toHaveBeenCalledTimes(1)
    expect(mockApi.getProductionProducts).toHaveBeenCalledTimes(1)
    expect(mockApi.getProductionChains).toHaveBeenCalledTimes(1)

    expect(store.isLoaded).toBe(true)
    expect(store.current).toStrictEqual(first)
    expect(store.current?.gameVersionId).toBe('v1')
  })

  it('dedupes concurrent loads of the same version (single-flight)', async () => {
    const store = useCatalogStore()

    // Two callers race before the first resolves: only one fetch round happens.
    const [a, b] = await Promise.all([store.load('v1'), store.load('v1')])

    expect(a).toStrictEqual(b)
    expect(mockApi.getCrops).toHaveBeenCalledTimes(1)
    expect(mockApi.getConstants).toHaveBeenCalledTimes(1)
    expect(mockApi.getProductionBuildingTypes).toHaveBeenCalledTimes(1)
  })

  it('caches each version key independently and switches `current`', async () => {
    const store = useCatalogStore()

    const v1 = await store.load('v1')
    const v2 = await store.load('v2')

    expect(v1.gameVersionId).toBe('v1')
    expect(v2.gameVersionId).toBe('v2')
    expect(mockApi.getCrops).toHaveBeenCalledTimes(2)
    expect(mockApi.getProductionBuildingTypes).toHaveBeenCalledTimes(2)
    // `current` follows the last-loaded key.
    expect(store.current?.gameVersionId).toBe('v2')

    // Re-loading v1 returns the cached catalog without re-fetching.
    const v1Again = await store.load('v1')
    expect(v1Again).toStrictEqual(v1)
    expect(mockApi.getCrops).toHaveBeenCalledTimes(2)
    expect(store.current?.gameVersionId).toBe('v1')
  })
})

describe('loadGameVersions (memoization)', () => {
  it('loads the version list once and reuses it', async () => {
    const versions = [{ id: 'v1' }] as GameVersion[]
    mockApi.getGameVersions.mockResolvedValue(versions)
    const store = useCatalogStore()

    const first = await store.loadGameVersions()
    const second = await store.loadGameVersions()

    expect(first).toStrictEqual(versions)
    expect(second).toStrictEqual(versions)
    expect(mockApi.getGameVersions).toHaveBeenCalledTimes(1)
  })
})
