// entities/production-building/model/productionBuilding.store — the Pinia
// 'productionBuilding' store: the buildings of the active farm.
// Keyed by `farmId`: a `load(farmId)` replaces the in-memory list and records
// the owning farm, so switching the active farm reloads.

import { defineStore } from 'pinia'
import * as productionBuildingApi from '../api/productionBuildingApi'
import type {
  ProductionBuilding,
  ProductionBuildingCreate,
  ProductionBuildingUpdate,
} from './types'
import { isApiError } from '~/shared/api'

interface ProductionBuildingState {
  farmId: string | null
  buildings: ProductionBuilding[]
  loading: boolean
  saving: boolean
  error: string | null
}

function errorMessage(err: unknown): string {
  if (isApiError(err)) return err.message
  if (err instanceof Error) return err.message
  return 'Error inesperado'
}

export const useProductionBuildingStore = defineStore('productionBuilding', {
  state: (): ProductionBuildingState => ({
    farmId: null,
    buildings: [],
    loading: false,
    saving: false,
    error: null,
  }),

  getters: {
    buildingById(state): (id: string) => ProductionBuilding | undefined {
      return (id: string) => state.buildings.find((b) => b.id === id)
    },

    buildingsByType(state): (typeSlug: string) => ProductionBuilding[] {
      return (typeSlug: string) =>
        state.buildings.filter((b) => b.buildingTypeSlug === typeSlug)
    },

    count(state): number {
      return state.buildings.length
    },
  },

  actions: {
    async load(farmId: string): Promise<ProductionBuilding[]> {
      this.loading = true
      this.error = null
      try {
        this.farmId = farmId
        this.buildings = await productionBuildingApi.list(farmId)
        return this.buildings
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.loading = false
      }
    },

    reset(): void {
      this.farmId = null
      this.buildings = []
      this.error = null
    },

    async create(
      farmId: string,
      body: ProductionBuildingCreate,
    ): Promise<ProductionBuilding> {
      this.saving = true
      this.error = null
      try {
        const building = await productionBuildingApi.create(farmId, body)
        if (this.farmId === farmId) this.buildings.push(building)
        return building
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.saving = false
      }
    },

    async update(
      farmId: string,
      buildingId: string,
      body: ProductionBuildingUpdate,
    ): Promise<ProductionBuilding> {
      this.saving = true
      this.error = null
      try {
        const building = await productionBuildingApi.update(farmId, buildingId, body)
        const idx = this.buildings.findIndex((b) => b.id === buildingId)
        if (idx >= 0) this.buildings[idx] = building
        return building
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.saving = false
      }
    },

    async remove(farmId: string, buildingId: string): Promise<void> {
      this.saving = true
      this.error = null
      try {
        await productionBuildingApi.remove(farmId, buildingId)
        this.buildings = this.buildings.filter((b) => b.id !== buildingId)
      } catch (err) {
        this.error = errorMessage(err)
        throw err
      } finally {
        this.saving = false
      }
    },
  },
})
