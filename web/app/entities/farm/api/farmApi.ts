// entities/farm/api/farmApi — typed wrappers over `shared/api` for the
// `/farms*` and `/me/settings` endpoints (docs/openapi.yaml, Farms +
// UserSettings tags).
//
// FSD: entities may depend on `shared`. Components/features must go through the
// farm store (model/farm.store), never call these network functions directly
// (docs/arquitectura-frontend.md §8.1).

import { del, get, getData, patch, post, request } from '~/shared/api'
import type {
  Farm,
  FarmCreate,
  FarmUpdate,
  FarmUpdateResult,
  UserSettings,
  UserSettingsUpdate,
} from '../model/types'

/** GET /farms — list the authenticated user's farms (paginated server-side). */
export function list(): Promise<Farm[]> {
  return getData<Farm[]>('/farms')
}

/** GET /farms/:id — fetch one farm. */
export async function get1(id: string): Promise<Farm> {
  const { data } = await get<Farm>(`/farms/${id}`)
  return data
}

/** POST /farms — create a farm (defaults to the active game version). */
export function create(body: FarmCreate): Promise<Farm> {
  return post<Farm>('/farms', body)
}

/**
 * PATCH /farms/:id — update a farm. Uses the full envelope so `meta.warnings`
 * (crops dropped on a game-version change) is surfaced to the caller.
 */
export async function update(id: string, body: FarmUpdate): Promise<FarmUpdateResult> {
  const { data, meta } = await request<Farm>(`/farms/${id}`, { method: 'PATCH', body })
  return { farm: data, warnings: meta?.warnings ?? [] }
}

/** DELETE /farms/:id — delete a farm (cascade, 204). */
export function remove(id: string): Promise<void> {
  return del<void>(`/farms/${id}`)
}

// --- User settings (active-farm pin lives here) -----------------------------

/** GET /me/settings — UI preferences incl. `activeFarmId` (created on demand). */
export async function getSettings(): Promise<UserSettings> {
  const { data } = await get<UserSettings>('/me/settings')
  return data
}

/** PATCH /me/settings — update UI preferences (e.g. the active farm pin). */
export function updateSettings(body: UserSettingsUpdate): Promise<UserSettings> {
  return patch<UserSettings>('/me/settings', body)
}
