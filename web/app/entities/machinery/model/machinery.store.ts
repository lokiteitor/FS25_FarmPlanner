// entities/machinery/model/machinery.store — the Pinia 'machinery' store: the
// machinery of the active farm. Keyed by `farmId`: a `load(farmId)` replaces the
// in-memory list and records the owning farm, so switching the active farm
// reloads.
//
// FSD: depends on `shared` (via the slice api) only. The active farm id is owned
// by entities/farm and passed in by callers (no sibling-entity import).

import { defineStore } from 'pinia'
import * as machineryApi from '../api/machineryApi'
import type { Machine, MachineCreate, MachineUpdate } from './types'
import { isApiError } from '~/shared/api'

interface MachineryState {
  /** The farm the current `machines` belong to (null before any load). */
  farmId: string | null
  /** Machinery of `farmId` (server order). */
  machines: Machine[]
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

export const useMachineryStore = defineStore('machinery', {
  state: (): MachineryState => ({
    farmId: null,
    machines: [],
    loading: false,
    saving: false,
    error: null,
  }),

  getters: {
    /** Lookup a loaded machine by id. */
    machineById(state): (id: string) => Machine | undefined {
      return (id: string) => state.machines.find((m) => m.id === id)
    },

    /** Number of machines currently loaded. */
    count(state): number {
      return state.machines.length
    },
  },

  actions: {
    /**
     * Load the machinery of `farmId`, replacing the in-memory list and recording
     * the owning farm. Call whenever the active farm changes.
     */
    async load(farmId: string): Promise<Machine[]> {
      this.loading = true
      this.error = null
      try {
        this.farmId = farmId
        this.machines = await machineryApi.list(farmId)
        return this.machines
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.loading = false
      }
    },

    /** Clear the loaded machinery (e.g. on logout or when no farm is active). */
    reset(): void {
      this.farmId = null
      this.machines = []
      this.error = null
    },

    /** Create a machine under `farmId` and append it to the list. */
    async create(farmId: string, body: MachineCreate): Promise<Machine> {
      this.saving = true
      this.error = null
      try {
        const machine = await machineryApi.create(farmId, body)
        if (this.farmId === farmId) this.machines.push(machine)
        return machine
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.saving = false
      }
    },

    /** Update a machine under `farmId` and patch it into the list. */
    async update(farmId: string, machineId: string, body: MachineUpdate): Promise<Machine> {
      this.saving = true
      this.error = null
      try {
        const machine = await machineryApi.update(farmId, machineId, body)
        const idx = this.machines.findIndex((m) => m.id === machineId)
        if (idx >= 0) this.machines[idx] = machine
        return machine
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.saving = false
      }
    },

    /** Delete a machine under `farmId` and drop it from the list. */
    async remove(farmId: string, machineId: string): Promise<void> {
      this.saving = true
      this.error = null
      try {
        await machineryApi.remove(farmId, machineId)
        this.machines = this.machines.filter((m) => m.id !== machineId)
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.saving = false
      }
    },
  },
})
