// entities/field/model/types — domain shapes for a farm field ("campo").
// Mirrors the `Field` / `FieldCreate` / `FieldUpdate` schemas in
// docs/openapi.yaml (nested under /farms/:farmId/fields).

/**
 * A field belonging to a farm. `cropId` references a catalog crop of the farm's
 * game version (null = fallow). `yieldBonus` null = inherit the farm default.
 */
export interface Field {
  id: string
  farmId: string
  /** 1-based field number, unique within the farm. */
  fieldNumber: number
  /** Area in hectares. */
  hectares: number
  /** Catalog crop id, or null when no crop is assigned. */
  cropId: string | null
  /** Whether the crop is harvested as silage (chopped). */
  isSilage: boolean
  /** Per-field yield-bonus override; null → inherits the farm's defaultYieldBonus. */
  yieldBonus: number | null
  /** What the field cost to buy, when recorded; null otherwise. */
  purchasePrice: number | null
  createdAt?: string
  updatedAt?: string
}

/** Body for `POST /farms/:farmId/fields` (FieldCreate). */
export interface FieldCreate {
  fieldNumber: number
  hectares: number
  cropId?: string | null
  /** Defaults to false on the backend. */
  isSilage?: boolean
  yieldBonus?: number | null
  purchasePrice?: number | null
}

/** Body for `PATCH /farms/:farmId/fields/:id` (FieldUpdate). All optional. */
export interface FieldUpdate {
  fieldNumber?: number
  hectares?: number
  cropId?: string | null
  isSilage?: boolean
  yieldBonus?: number | null
  purchasePrice?: number | null
}
