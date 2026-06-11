// entities/harvest-record/model/types — domain shape for a harvest record.
// Mirrors the HarvestRecord schema in the API (api/src/schemas/harvests.ts).

/**
 * A single harvest event for a field.
 * Persisted when the user transitions a field from 'sown' to 'fallow' via the
 * harvest action.
 */
export interface HarvestRecord {
  id: string
  farmId: string
  fieldId: string
  /** Catalog crop id at the time of harvest; null if the crop was later deleted. */
  cropId: string | null
  /** Snapshot of the field number at harvest time. */
  fieldNumber: number
  /** Whether the crop was harvested as silage. */
  isSilage: boolean
  /** Actual yield reported by the user, in liters. */
  actualYieldLiters: number
  /** Engine projection at the time of harvest; null if unavailable. */
  projectedYieldLiters: number | null
  /** ISO 8601 timestamp when the harvest was recorded. */
  harvestedAt: string
  createdAt: string
}
