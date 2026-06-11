// entities/stable/model/stable.store — the Pinia 'stable' store: the stables of
// the active farm. Keyed by `farmId`: a `load(farmId)` replaces the in-memory
// list and records the owning farm, so switching the active farm reloads.
//
// FSD: depends on `shared` (via the slice api) only. The active farm id is owned
// by entities/farm and passed in by callers (no sibling-entity import).

import { defineStore } from 'pinia'
import * as stableApi from '../api/stableApi'
import type { Stable, StableCreate, StableUpdate } from './types'
import { isApiError } from '~/shared/api'

interface StableState {
  /** The farm the current `stables` belong to (null before any load). */
  farmId: string | null
  /** Stables of `farmId` (server order). */
  stables: Stable[]
  /** True while a list load is in flight. */
  loading: boolean
  /** True while a create/update/delete mutation is in flight. */
  saving: boolean
  /** Last error message (cleared at the start of each action), or null. */
  error: string | null
}

/** Extract a user-facing message from an unknown thrown value. */
function errorMessage(err: unknown): string {
  if (isApiError(err)) return err.message
  if (err instanceof Error) return err.message
  return 'Error inesperado'
}

export const useStableStore = defineStore('stable', {
  state: (): StableState => ({
    farmId: null,
    stables: [],
    loading: false,
    saving: false,
    error: null,
  }),

  getters: {
    /** Lookup a loaded stable by id. */
    stableById(state): (id: string) => Stable | undefined {
      return (id: string) => state.stables.find((s) => s.id === id)
    },

    /** Stables filtered by species. */
    stablesBySpecies(state): (species: Stable['species']) => Stable[] {
      return (species) => state.stables.filter((s) => s.species === species)
    },

    /** Number of stables currently loaded. */
    count(state): number {
      return state.stables.length
    },

    /** Sum of current head counts across all stables. */
    totalAnimals(state): number {
      return state.stables.reduce((sum, s) => sum + s.currentCount, 0)
    },
  },

  actions: {
    /**
     * Load the stables of `farmId`, replacing the in-memory list and recording
     * the owning farm. Call whenever the active farm changes.
     */
    async load(farmId: string): Promise<Stable[]> {
      this.loading = true
      this.error = null
      try {
        this.farmId = farmId
        this.stables = await stableApi.list(farmId)
        return this.stables
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.loading = false
      }
    },

    /** Clear the loaded stables (e.g. on logout or when no farm is active). */
    reset(): void {
      this.farmId = null
      this.stables = []
      this.error = null
    },

    /** Create a stable under `farmId` and append it to the list. */
    async create(farmId: string, body: StableCreate): Promise<Stable> {
      this.saving = true
      this.error = null
      try {
        const stable = await stableApi.create(farmId, body)
        if (this.farmId === farmId) this.stables.push(stable)
        return stable
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.saving = false
      }
    },

    /** Update a stable under `farmId` and patch it into the list. */
    async update(farmId: string, stableId: string, body: StableUpdate): Promise<Stable> {
      this.saving = true
      this.error = null
      try {
        const stable = await stableApi.update(farmId, stableId, body)
        const idx = this.stables.findIndex((s) => s.id === stableId)
        if (idx >= 0) this.stables[idx] = stable
        return stable
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.saving = false
      }
    },

    /** Delete a stable under `farmId` and drop it from the list. */
    async remove(farmId: string, stableId: string): Promise<void> {
      this.saving = true
      this.error = null
      try {
        await stableApi.remove(farmId, stableId)
        this.stables = this.stables.filter((s) => s.id !== stableId)
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.saving = false
      }
    },
  },
})
