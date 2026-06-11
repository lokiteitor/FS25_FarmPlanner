// entities/stable/api/stableApi — typed wrappers over `shared/api` for the
// `/farms/:farmId/stables*` endpoints (docs/openapi.yaml, Stables tag).
//
// Every call is scoped to a farm via the leading `farmId` argument. FSD:
// entities depend on `shared`; components/features go through the stable store,
// never these functions directly (docs/arquitectura-frontend.md §8.1).

import { del, get, getData, patch, post } from '~/shared/api'
import type { Stable, StableCreate, StableUpdate } from '../model/types'

/** Path to the stables collection of a farm. */
function base(farmId: string): string {
  return `/farms/${farmId}/stables`
}

/** GET /farms/:farmId/stables — list a farm's stables. */
export function list(farmId: string): Promise<Stable[]> {
  return getData<Stable[]>(base(farmId))
}

/** GET /farms/:farmId/stables/:id — one stable. */
export async function get1(farmId: string, stableId: string): Promise<Stable> {
  const { data } = await get<Stable>(`${base(farmId)}/${stableId}`)
  return data
}

/** POST /farms/:farmId/stables — create a stable. */
export function create(farmId: string, body: StableCreate): Promise<Stable> {
  return post<Stable>(base(farmId), body)
}

/** PATCH /farms/:farmId/stables/:id — update a stable. */
export function update(farmId: string, stableId: string, body: StableUpdate): Promise<Stable> {
  return patch<Stable>(`${base(farmId)}/${stableId}`, body)
}

/** DELETE /farms/:farmId/stables/:id — delete a stable (204). */
export function remove(farmId: string, stableId: string): Promise<void> {
  return del<void>(`${base(farmId)}/${stableId}`)
}
