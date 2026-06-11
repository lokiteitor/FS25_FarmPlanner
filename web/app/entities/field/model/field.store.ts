// entities/field/model/field.store — the Pinia 'field' store: the fields of the
// active farm. Keyed by `farmId`: a `load(farmId)` replaces the in-memory list
// and records which farm it belongs to, so switching the active farm reloads.
//
// FSD: depends on `shared` (via the slice api) only. The active farm id is owned
// by entities/farm; callers pass it in (this store does not import the farm
// store), keeping the slice independently testable.

import { defineStore } from 'pinia'
import * as fieldApi from '../api/fieldApi'
import type { Field, FieldCreate, FieldUpdate } from './types'
import { isApiError } from '~/shared/api'

interface FieldState {
  /** The farm the current `fields` belong to (null before any load). */
  farmId: string | null
  /** Fields of `farmId`, ordered by fieldNumber (server order). */
  fields: Field[]
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

export const useFieldStore = defineStore('field', {
  state: (): FieldState => ({
    farmId: null,
    fields: [],
    loading: false,
    saving: false,
    error: null,
  }),

  getters: {
    /** Lookup a loaded field by id. */
    fieldById(state): (id: string) => Field | undefined {
      return (id: string) => state.fields.find((f) => f.id === id)
    },

    /** Number of fields currently loaded. */
    count(state): number {
      return state.fields.length
    },

    /** Sum of all field areas (hectares) — handy for dashboards. */
    totalHectares(state): number {
      return state.fields.reduce((sum, f) => sum + f.hectares, 0)
    },
  },

  actions: {
    /**
     * Load the fields of `farmId`, replacing the in-memory list and recording
     * the owning farm. Call whenever the active farm changes.
     */
    async load(farmId: string): Promise<Field[]> {
      this.loading = true
      this.error = null
      try {
        this.farmId = farmId
        this.fields = await fieldApi.list(farmId)
        return this.fields
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.loading = false
      }
    },

    /** Clear the loaded fields (e.g. on logout or when no farm is active). */
    reset(): void {
      this.farmId = null
      this.fields = []
      this.error = null
    },

    /** Create a field under `farmId` and append it to the list. */
    async create(farmId: string, body: FieldCreate): Promise<Field> {
      this.saving = true
      this.error = null
      try {
        const field = await fieldApi.create(farmId, body)
        if (this.farmId === farmId) this.fields.push(field)
        return field
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.saving = false
      }
    },

    /** Update a field under `farmId` and patch it into the list. */
    async update(farmId: string, fieldId: string, body: FieldUpdate): Promise<Field> {
      this.saving = true
      this.error = null
      try {
        const field = await fieldApi.update(farmId, fieldId, body)
        const idx = this.fields.findIndex((f) => f.id === fieldId)
        if (idx >= 0) this.fields[idx] = field
        return field
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.saving = false
      }
    },

    /** Delete a field under `farmId` and drop it from the list. */
    async remove(farmId: string, fieldId: string): Promise<void> {
      this.saving = true
      this.error = null
      try {
        await fieldApi.remove(farmId, fieldId)
        this.fields = this.fields.filter((f) => f.id !== fieldId)
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.saving = false
      }
    },
  },
})
