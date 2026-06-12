// entities/production-building — public API of the production-building slice.
//
// Higher layers (pages, widgets, features) import ONLY from here.

export { useProductionBuildingStore } from './model/productionBuilding.store'

export * as productionBuildingApi from './api/productionBuildingApi'

export type {
  ProductionBuilding,
  ProductionBuildingCreate,
  ProductionBuildingUpdate,
  UserChain,
  UserProductionIO,
} from './model/types'
