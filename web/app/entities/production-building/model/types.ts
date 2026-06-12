// entities/production-building/model/types — TypeScript shapes for the
// production buildings domain entity, mirroring the API DTO.

/** A single IO line in a user-defined chain recipe. */
export interface UserProductionIO {
  slug: string
  quantityPerCycle: number
}

/**
 * A chain (recipe) entry in a production building's `chains` array.
 *
 * - `catalogChainSlug`: null for fully custom (mod) chains.
 * - `cyclesPerMonth`, `inputs`, `outputs`: null means "use catalog default".
 *   The widget resolves these before passing to the engine.
 */
export interface UserChain {
  id: string
  catalogChainSlug: string | null
  name: string
  isActive: boolean
  cyclesPerMonth?: number | null
  inputs?: UserProductionIO[] | null
  outputs?: UserProductionIO[] | null
}

/** A production building (factory, greenhouse, etc.) in a farm. */
export interface ProductionBuilding {
  id: string
  farmId: string
  name: string
  buildingTypeSlug: string
  chains: UserChain[]
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** Payload for creating a production building. */
export interface ProductionBuildingCreate {
  name: string
  buildingTypeSlug: string
  chains?: UserChain[]
  notes?: string | null
}

/** Payload for updating a production building (all fields optional). */
export interface ProductionBuildingUpdate {
  name?: string
  buildingTypeSlug?: string
  chains?: UserChain[]
  notes?: string | null
}
