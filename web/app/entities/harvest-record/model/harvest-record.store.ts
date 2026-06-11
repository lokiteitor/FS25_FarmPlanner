// entities/harvest-record/model/harvest-record.store — Pinia store for harvest
// records. Keyed by `farmId`: a `load(farmId)` replaces the in-memory list.
//
// FSD: depends on `shared` (via the slice api) only. The active farm id is
// owned by entities/farm; callers pass it in — keeping this slice independently
// testable.

import { defineStore } from 'pinia'
import * as harvestRecordApi from '../api/harvestRecordApi'
import type { HarvestRecord } from './types'
import { isApiError } from '~/shared/api'

interface HarvestRecordState {
  /** The farm the current `records` belong to (null before any load). */
  farmId: string | null
  /** Harvest records of `farmId`, ordered by most recent first. */
  records: HarvestRecord[]
  /** True while a list load is in flight. */
  loading: boolean
  /** Last error message, or null. */
  error: string | null
}

function errorMessage(err: unknown): string {
  if (isApiError(err)) return err.message
  if (err instanceof Error) return err.message
  return 'Error inesperado'
}

export const useHarvestRecordStore = defineStore('harvest-record', {
  state: (): HarvestRecordState => ({
    farmId: null,
    records: [],
    loading: false,
    error: null,
  }),

  getters: {
    /** Total number of harvests. */
    count(state): number {
      return state.records.length
    },

    /** Sum of actual yield liters across all records. */
    totalActualYieldLiters(state): number {
      return state.records.reduce((sum, r) => sum + r.actualYieldLiters, 0)
    },
  },

  actions: {
    /**
     * Load harvest records for `farmId`, replacing the in-memory list.
     * Call whenever the active farm changes or after a harvest action.
     */
    async load(farmId: string): Promise<HarvestRecord[]> {
      this.loading = true
      this.error = null
      try {
        this.farmId = farmId
        this.records = await harvestRecordApi.list(farmId)
        return this.records
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.loading = false
      }
    },

    /** Clear the loaded records (e.g. on logout or when no farm is active). */
    reset(): void {
      this.farmId = null
      this.records = []
      this.error = null
    },
  },
})
