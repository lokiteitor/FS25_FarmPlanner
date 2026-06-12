// entities/production-building/api/productionBuildingApi — typed wrappers
// over `shared/api` for the `/farms/:farmId/production-buildings` endpoints.
//
// FSD: entities may depend on `shared`. Features/widgets must go through the
// store, never call these functions directly.

import { getData, get, post, patch, del } from '~/shared/api'
import type {
  ProductionBuilding,
  ProductionBuildingCreate,
  ProductionBuildingUpdate,
} from '../model/types'

function base(farmId: string): string {
  return `/farms/${farmId}/production-buildings`
}

/** GET /farms/:farmId/production-buildings → ProductionBuilding[] */
export function list(farmId: string): Promise<ProductionBuilding[]> {
  return getData<ProductionBuilding[]>(base(farmId))
}

/** GET /farms/:farmId/production-buildings/:id → ProductionBuilding */
export async function get1(
  farmId: string,
  id: string,
): Promise<ProductionBuilding> {
  const { data } = await get<ProductionBuilding>(`${base(farmId)}/${id}`)
  return data
}

/** POST /farms/:farmId/production-buildings → 201 ProductionBuilding */
export function create(
  farmId: string,
  payload: ProductionBuildingCreate,
): Promise<ProductionBuilding> {
  return post<ProductionBuilding>(base(farmId), payload)
}

/** PATCH /farms/:farmId/production-buildings/:id → ProductionBuilding */
export function update(
  farmId: string,
  id: string,
  payload: ProductionBuildingUpdate,
): Promise<ProductionBuilding> {
  return patch<ProductionBuilding>(`${base(farmId)}/${id}`, payload)
}

/** DELETE /farms/:farmId/production-buildings/:id → 204 */
export function remove(farmId: string, id: string): Promise<void> {
  return del(`${base(farmId)}/${id}`)
}
