// features/calculator-config/api/animalConfigApi — typed wrappers over
// `shared/api` for the `/farms/:farmId/animal-configs*` endpoints
// (docs/openapi.yaml, AnimalConfigs tag).
//
// FSD: features may depend on `shared`. Components go through the
// useCalculatorConfig composable, not these functions directly (FSD §8.1).
//
// GET returns 404 (CONFIG_NOT_FOUND) when the species has no saved config; the
// composable treats that as "use catalog defaults" rather than an error.

import { del, get, isApiError, put } from '~/shared/api'
import type { AnimalConfig, AnimalConfigInputs, AnimalSpecies } from '../model/types'

/** Path to the animal-configs collection of a farm. */
function base(farmId: string): string {
  return `/farms/${farmId}/animal-configs`
}

/** GET /farms/:farmId/animal-configs — all saved species configs (0..7). */
export async function list(farmId: string): Promise<AnimalConfig[]> {
  const { data } = await get<AnimalConfig[]>(base(farmId))
  return data
}

/**
 * GET /farms/:farmId/animal-configs/:species — one species config, or `null`
 * when none has been saved yet (404 CONFIG_NOT_FOUND). Any other error rethrows.
 */
export async function getOne(
  farmId: string,
  species: AnimalSpecies,
): Promise<AnimalConfig | null> {
  try {
    const { data } = await get<AnimalConfig>(`${base(farmId)}/${species}`)
    return data
  } catch (err) {
    if (isApiError(err) && err.status === 404) return null
    throw err
  }
}

/**
 * PUT /farms/:farmId/animal-configs/:species — upsert (create or replace) the
 * species config. The body is the discriminated `inputs` object; its `species`
 * must match the route species (enforced server-side).
 */
export function upsert(
  farmId: string,
  species: AnimalSpecies,
  inputs: AnimalConfigInputs,
): Promise<AnimalConfig> {
  return put<AnimalConfig>(`${base(farmId)}/${species}`, inputs)
}

/** DELETE /farms/:farmId/animal-configs/:species — reset to catalog defaults (204). */
export function remove(farmId: string, species: AnimalSpecies): Promise<void> {
  return del(`${base(farmId)}/${species}`)
}
