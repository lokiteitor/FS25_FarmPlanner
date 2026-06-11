// entities/field/api/fieldApi — typed wrappers over `shared/api` for the
// `/farms/:farmId/fields*` endpoints (docs/openapi.yaml, Fields tag).
//
// Every call is scoped to a farm: the `farmId` is the first argument and builds
// the path. FSD: entities depend on `shared`; components/features go through the
// field store, never these functions directly (docs/arquitectura-frontend.md §8.1).

import { del, get, getData, patch, post } from '~/shared/api'
import type { Field, FieldCreate, FieldHarvestBody, FieldUpdate } from '../model/types'

/** Path to the fields collection of a farm. */
function base(farmId: string): string {
  return `/farms/${farmId}/fields`
}

/** GET /farms/:farmId/fields — fields ordered by fieldNumber. */
export function list(farmId: string): Promise<Field[]> {
  return getData<Field[]>(base(farmId))
}

/** GET /farms/:farmId/fields/:id — one field. */
export async function get1(farmId: string, fieldId: string): Promise<Field> {
  const { data } = await get<Field>(`${base(farmId)}/${fieldId}`)
  return data
}

/** POST /farms/:farmId/fields — create a field. */
export function create(farmId: string, body: FieldCreate): Promise<Field> {
  return post<Field>(base(farmId), body)
}

/** PATCH /farms/:farmId/fields/:id — update a field. */
export function update(farmId: string, fieldId: string, body: FieldUpdate): Promise<Field> {
  return patch<Field>(`${base(farmId)}/${fieldId}`, body)
}

/** DELETE /farms/:farmId/fields/:id — delete a field (204). */
export function remove(farmId: string, fieldId: string): Promise<void> {
  return del<void>(`${base(farmId)}/${fieldId}`)
}

// ── Lifecycle actions ──────────────────────────────────────────────────────

/** POST /farms/:farmId/fields/:id/sow — mark field as sown (fallow → sown). */
export function sow(farmId: string, fieldId: string): Promise<Field> {
  return post<Field>(`${base(farmId)}/${fieldId}/sow`, {})
}

/** POST /farms/:farmId/fields/:id/cancel-sow — cancel sowing without harvest. */
export function cancelSow(farmId: string, fieldId: string): Promise<Field> {
  return post<Field>(`${base(farmId)}/${fieldId}/cancel-sow`, {})
}

/** POST /farms/:farmId/fields/:id/harvest — record harvest and reset to fallow. */
export function harvest(
  farmId: string,
  fieldId: string,
  body: FieldHarvestBody,
): Promise<Field> {
  return post<Field>(`${base(farmId)}/${fieldId}/harvest`, body)
}
