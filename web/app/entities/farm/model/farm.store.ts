// entities/farm/model/farm.store — the Pinia 'farm' store: source of truth for
// the user's farms ("partidas") and which one is active.
//
// The active farm id is mirrored to the server via `user_settings.activeFarmId`
// (/me/settings GET/PATCH) so it survives reloads and devices. We keep a local
// `activeFarmId` for synchronous reads and write it through on `setActiveFarm`.
//
// FSD: depends on `shared` (via the slice api) only. Higher layers consume the
// store; when the active farm changes the UI is expected to (re)load the catalog
// store for `activeGameVersionId` — this store does NOT import the catalog store
// (it does not depend on sibling entities at runtime).

import { defineStore } from 'pinia'
import * as farmApi from '../api/farmApi'
import type { Farm, FarmCreate, FarmUpdate } from './types'
import { isApiError } from '~/shared/api'

interface FarmState {
  /** All farms owned by the user (server order). */
  farms: Farm[]
  /** Active farm id, mirrored to user_settings.activeFarmId. */
  activeFarmId: string | null
  /** True while a list/settings load is in flight. */
  loading: boolean
  /** True while a create/update/delete/setActive mutation is in flight. */
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

export const useFarmStore = defineStore('farm', {
  state: (): FarmState => ({
    farms: [],
    activeFarmId: null,
    loading: false,
    saving: false,
    error: null,
  }),

  getters: {
    /** The active farm object, or null when none is selected/loaded. */
    activeFarm(state): Farm | null {
      return state.farms.find((f) => f.id === state.activeFarmId) ?? null
    },

    /** The game version id of the active farm (drives catalog loading), or null. */
    activeGameVersionId(): string | null {
      return this.activeFarm?.gameVersionId ?? null
    },

    /** Lookup a farm by id. */
    farmById(state): (id: string) => Farm | undefined {
      return (id: string) => state.farms.find((f) => f.id === id)
    },

    /** True once farms have been loaded and at least one exists. */
    hasFarms(state): boolean {
      return state.farms.length > 0
    },
  },

  actions: {
    /** Load the farms list. Replaces `farms`; does not touch the active id. */
    async loadFarms(): Promise<Farm[]> {
      this.loading = true
      this.error = null
      try {
        this.farms = await farmApi.list()
        return this.farms
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.loading = false
      }
    },

    /** Create a farm, append it to the list, and return it. */
    async createFarm(body: FarmCreate): Promise<Farm> {
      this.saving = true
      this.error = null
      try {
        const farm = await farmApi.create(body)
        this.farms.push(farm)
        return farm
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.saving = false
      }
    },

    /**
     * Update a farm and patch it into the list. Returns the warnings reported by
     * the backend (e.g. crops dropped when the game version changed) so the UI
     * can show them.
     */
    async updateFarm(id: string, body: FarmUpdate): Promise<string[]> {
      this.saving = true
      this.error = null
      try {
        const { farm, warnings } = await farmApi.update(id, body)
        const idx = this.farms.findIndex((f) => f.id === id)
        if (idx >= 0) this.farms[idx] = farm
        else this.farms.push(farm)
        return warnings
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.saving = false
      }
    },

    /**
     * Delete a farm and drop it from the list. If it was the active farm, the
     * pin is cleared locally and on the server (/me/settings).
     */
    async deleteFarm(id: string): Promise<void> {
      this.saving = true
      this.error = null
      try {
        await farmApi.remove(id)
        this.farms = this.farms.filter((f) => f.id !== id)
        if (this.activeFarmId === id) {
          await this.setActiveFarm(null)
        }
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.saving = false
      }
    },

    /**
     * Set (or clear) the active farm. Persists the pin to user_settings via
     * PATCH /me/settings, then updates the local id. Pass `null` to unset.
     */
    async setActiveFarm(id: string | null): Promise<void> {
      this.saving = true
      this.error = null
      try {
        const settings = await farmApi.updateSettings({ activeFarmId: id })
        this.activeFarmId = settings.activeFarmId
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.saving = false
      }
    },

    /**
     * Ensure an active farm is selected after farms are loaded. Reads the
     * persisted `activeFarmId` from /me/settings; if it points at a farm we
     * still own, adopt it. Otherwise fall back to the first farm and persist the
     * choice. Returns the resolved active farm id (or null when there are none).
     *
     * Call after {@link loadFarms} (it does not load the list itself).
     */
    async ensureActive(): Promise<string | null> {
      this.loading = true
      this.error = null
      try {
        const settings = await farmApi.getSettings()
        const pinned = settings.activeFarmId
        const pinnedExists = pinned !== null && this.farms.some((f) => f.id === pinned)

        if (pinnedExists) {
          this.activeFarmId = pinned
          return pinned
        }

        const first = this.farms[0]?.id ?? null
        if (first !== pinned) {
          // Persist the fallback so future loads are consistent.
          await this.setActiveFarm(first)
        } else {
          this.activeFarmId = first
        }
        return this.activeFarmId
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.loading = false
      }
    },
  },
})
