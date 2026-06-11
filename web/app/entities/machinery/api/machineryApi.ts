// entities/machinery/api/machineryApi — typed wrappers over `shared/api` for the
// `/farms/:farmId/machinery*` endpoints (docs/openapi.yaml, Machinery tag).
//
// Every call is scoped to a farm via the leading `farmId` argument. FSD:
// entities depend on `shared`; components/features go through the machinery
// store, never these functions directly (docs/arquitectura-frontend.md §8.1).

import { del, get, getData, patch, post } from '~/shared/api'
import type { Machine, MachineCreate, MachineUpdate } from '../model/types'

/** Path to the machinery collection of a farm. */
function base(farmId: string): string {
  return `/farms/${farmId}/machinery`
}

/** GET /farms/:farmId/machinery — list a farm's machinery. */
export function list(farmId: string): Promise<Machine[]> {
  return getData<Machine[]>(base(farmId))
}

/** GET /farms/:farmId/machinery/:id — one machine. */
export async function get1(farmId: string, machineId: string): Promise<Machine> {
  const { data } = await get<Machine>(`${base(farmId)}/${machineId}`)
  return data
}

/** POST /farms/:farmId/machinery — create a machine. */
export function create(farmId: string, body: MachineCreate): Promise<Machine> {
  return post<Machine>(base(farmId), body)
}

/** PATCH /farms/:farmId/machinery/:id — update a machine. */
export function update(farmId: string, machineId: string, body: MachineUpdate): Promise<Machine> {
  return patch<Machine>(`${base(farmId)}/${machineId}`, body)
}

/** DELETE /farms/:farmId/machinery/:id — delete a machine (204). */
export function remove(farmId: string, machineId: string): Promise<void> {
  return del<void>(`${base(farmId)}/${machineId}`)
}
