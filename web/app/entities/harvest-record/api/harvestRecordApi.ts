// entities/harvest-record/api/harvestRecordApi — typed wrapper over shared/api
// for the `/farms/:farmId/harvests` endpoint.
//
// FSD: entities depend on `shared`; features/pages go through the store, not
// these functions directly.

import { getData } from '~/shared/api'
import type { HarvestRecord } from '../model/types'

/** GET /farms/:farmId/harvests — all harvest records ordered by most recent first. */
export function list(farmId: string): Promise<HarvestRecord[]> {
  return getData<HarvestRecord[]>(`/farms/${farmId}/harvests`)
}
