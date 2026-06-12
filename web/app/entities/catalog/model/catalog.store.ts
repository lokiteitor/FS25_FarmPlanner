// entities/catalog/model/catalog.store — the Pinia 'catalog' store. Caches the
// four versioned catalogs (crops, silage crops, animal types, constants) per
// gameVersionId so the engine and widgets can read them synchronously.
//
// FSD: depends on `shared` (via the slice api) only. Higher layers consume the
// store getters; the engine itself (shared/lib/engine) stays pure and receives
// the catalog as an argument (ADR-F04) — it never imports this store.
//
// Caching policy: a `load(gameVersionId)` loads all four endpoints in parallel
// ONCE per version key and memoizes the resulting `Catalog`. Concurrent callers
// for the same key await the same in-flight promise (single-flight), and a
// successful load is never re-fetched. Passing no id resolves the active
// version on the backend; we cache that under a dedicated ACTIVE sentinel key.

import { defineStore } from 'pinia'
import * as catalogApi from '../api/catalogApi'
import type {
  AnimalSpecies,
  AnimalType,
  Catalog,
  GameConstants,
  GameVersion,
  Crop,
  SilageCrop,
  ProductionBuildingType,
  ProductionChain,
  ProductionProduct,
} from './types'

/** Cache key used when the caller does not pin a version (active version). */
const ACTIVE_KEY = '__active__'

interface CatalogState {
  /** Memoized catalogs by version key (gameVersionId or ACTIVE_KEY). */
  byVersion: Record<string, Catalog>
  /** In-flight loads by version key, for single-flight dedupe. */
  loading: Record<string, Promise<Catalog>>
  /** The version key most recently loaded (drives the convenience getters). */
  currentKey: string | null
  /** Available game versions (loaded once, drives the farm create/edit form). */
  gameVersions: GameVersion[]
  /** In-flight game-versions load, for single-flight dedupe. */
  gameVersionsLoading: Promise<GameVersion[]> | null
}

/** Resolve the cache key for a (possibly undefined) version id. */
function keyOf(gameVersionId?: string): string {
  return gameVersionId ?? ACTIVE_KEY
}

export const useCatalogStore = defineStore('catalog', {
  state: (): CatalogState => ({
    byVersion: {},
    loading: {},
    currentKey: null,
    gameVersions: [],
    gameVersionsLoading: null,
  }),

  getters: {
    /** The catalog for the current (last-loaded) version, or null. */
    current(state): Catalog | null {
      return state.currentKey ? (state.byVersion[state.currentKey] ?? null) : null
    },

    /** True once the current version's catalog is cached. */
    isLoaded(state): boolean {
      return state.currentKey !== null && state.byVersion[state.currentKey] !== undefined
    },

    /** Global balance constants of the current version (or null). */
    constants(): GameConstants | null {
      return this.current?.constants ?? null
    },

    /** Lookup a crop by slug in the current version. */
    cropBySlug(): (slug: string) => Crop | undefined {
      const catalog = this.current
      return (slug: string) => catalog?.crops.find((c) => c.slug === slug)
    },

    /**
     * Lookup a crop by its catalog id in the current version. Needed because
     * `Field.cropId` references a crop by id, while the engine works by slug.
     */
    cropById(): (id: string) => Crop | undefined {
      const catalog = this.current
      return (id: string) => catalog?.crops.find((c) => c.id === id)
    },

    /** Lookup a silage crop by its base crop slug in the current version. */
    silageByCropSlug(): (cropSlug: string) => SilageCrop | undefined {
      const catalog = this.current
      return (cropSlug: string) => catalog?.silageCrops.find((s) => s.cropSlug === cropSlug)
    },

    /** Lookup a silage crop by its id in the current version. */
    silageById(): (id: string) => SilageCrop | undefined {
      const catalog = this.current
      return (id: string) => catalog?.silageCrops.find((s) => s.id === id)
    },

    /** Lookup an animal type by species in the current version. */
    animalTypeBySpecies(): (species: AnimalSpecies) => AnimalType | undefined {
      const catalog = this.current
      return (species: AnimalSpecies) =>
        catalog?.animalTypes.find((a) => a.species === species)
    },

    /** Lookup a production building type by slug in the current version. */
    productionBuildingTypeBySlug(): (slug: string) => ProductionBuildingType | undefined {
      const catalog = this.current
      return (slug: string) =>
        catalog?.productionBuildingTypes.find((bt) => bt.slug === slug)
    },

    /** Lookup a production product by slug in the current version. */
    productionProductBySlug(): (slug: string) => ProductionProduct | undefined {
      const catalog = this.current
      return (slug: string) =>
        catalog?.productionProducts.find((p) => p.slug === slug)
    },

    /** All production chains for a given building type slug. */
    productionChainsByBuildingType(): (buildingTypeSlug: string) => ProductionChain[] {
      const catalog = this.current
      return (buildingTypeSlug: string) =>
        catalog?.productionChains.filter(
          (c) => c.buildingTypeSlug === buildingTypeSlug,
        ) ?? []
    },

    /** Lookup a production chain by slug in the current version. */
    productionChainBySlug(): (slug: string) => ProductionChain | undefined {
      const catalog = this.current
      return (slug: string) =>
        catalog?.productionChains.find((c) => c.slug === slug)
    },

    /**
     * Resolve the display name (Spanish) for any IO slug. Checks crops first,
     * then production products, then falls back to the raw slug.
     */
    resolveIoLabel(): (slug: string) => string {
      const catalog = this.current
      return (slug: string) => {
        const crop = catalog?.crops.find((c) => c.slug === slug)
        if (crop) return crop.nameEs
        const product = catalog?.productionProducts.find((p) => p.slug === slug)
        if (product) return product.nameEs
        return slug
      }
    },
  },

  actions: {
    /**
     * Load (or reuse) the full catalog for a version. Loads all four endpoints
     * in parallel exactly once per version key; subsequent calls return the
     * cached `Catalog`. Sets `currentKey` so the getters target this version.
     */
    async load(gameVersionId?: string): Promise<Catalog> {
      const key = keyOf(gameVersionId)

      // Already cached: just make it current and return it (no network).
      const cached = this.byVersion[key]
      if (cached) {
        this.currentKey = key
        return cached
      }

      // A load is already in flight for this key: await it (single-flight).
      const inFlight = this.loading[key]
      if (inFlight) {
        const catalog = await inFlight
        this.currentKey = key
        return catalog
      }

      const promise = this.fetchAll(gameVersionId)
      this.loading[key] = promise
      try {
        const catalog = await promise
        this.byVersion[key] = catalog
        // Also index by the resolved id so a later explicit load(resolvedId)
        // hits the cache instead of re-fetching the active version.
        if (catalog.gameVersionId && catalog.gameVersionId !== key) {
          this.byVersion[catalog.gameVersionId] = catalog
        }
        this.currentKey = key
        return catalog
      } finally {
        delete this.loading[key]
      }
    },

    /**
     * Load (or reuse) the list of available game versions. Single-flight and
     * memoized: a successful load is cached on `gameVersions` and never
     * re-fetched. Used by the farm create/edit form (gameVersionId select).
     */
    async loadGameVersions(): Promise<GameVersion[]> {
      if (this.gameVersions.length > 0) return this.gameVersions
      if (this.gameVersionsLoading) return this.gameVersionsLoading

      const promise = catalogApi.getGameVersions()
      this.gameVersionsLoading = promise
      try {
        this.gameVersions = await promise
        return this.gameVersions
      } finally {
        this.gameVersionsLoading = null
      }
    },

    /** Fetch all catalogs in parallel and assemble a `Catalog`. */
    async fetchAll(gameVersionId?: string): Promise<Catalog> {
      const [
        crops,
        silageCrops,
        animalTypes,
        constants,
        productionBuildingTypes,
        productionProducts,
        productionChains,
      ] = await Promise.all([
        catalogApi.getCrops(gameVersionId),
        catalogApi.getSilageCrops(gameVersionId),
        catalogApi.getAnimalTypes(gameVersionId),
        catalogApi.getConstants(gameVersionId),
        catalogApi.getProductionBuildingTypes(gameVersionId),
        catalogApi.getProductionProducts(gameVersionId),
        catalogApi.getProductionChains(gameVersionId),
      ])
      return {
        // Prefer the explicit id; otherwise we leave it as the active sentinel
        // so callers can still tell whether a specific version was requested.
        gameVersionId: gameVersionId ?? ACTIVE_KEY,
        crops,
        silageCrops,
        animalTypes,
        constants,
        productionBuildingTypes,
        productionProducts,
        productionChains,
      }
    },
  },
})
