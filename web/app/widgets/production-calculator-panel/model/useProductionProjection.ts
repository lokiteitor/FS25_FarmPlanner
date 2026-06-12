// widgets/production-calculator-panel/model/useProductionProjection —
// composable that resolves a ProductionBuilding's chains (applying overrides
// against the catalog) and calls the production engine.
//
// Pattern mirrors useAnimalProjection in animal-calculator-panels.
// Returns null until the catalog is loaded.

import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useCatalogStore } from '~/entities/catalog'
import type { ProductionBuilding, UserChain } from '~/entities/production-building'
import { productionProjection } from '~/shared/lib/engine'
import type {
  EngineProductionBuilding,
  EngineProductionChain,
  EngineProductionIO,
  ProductionBuildingResult,
} from '~/shared/lib/engine'

/**
 * Resolve a UserChain to an EngineProductionChain by applying overrides
 * against the catalog chain (when a catalogChainSlug is present).
 *
 * - If a field override is null, the catalog value is used.
 * - For fully custom chains (catalogChainSlug = null), all fields are taken
 *   directly from the UserChain (they are required in that case).
 * - Label enrichment: each IO slug is resolved to a human-readable label
 *   via the catalog's `resolveIoLabel` getter.
 */
function resolveChain(
  chain: UserChain,
  resolveLabel: (slug: string) => string,
  catalogChainBySlug: (slug: string) => { cyclesPerMonth: number; inputs: { slug: string; quantityPerCycle: number }[]; outputs: { slug: string; quantityPerCycle: number }[] } | undefined,
): EngineProductionChain | null {
  let cyclesPerMonth: number
  let rawInputs: { slug: string; quantityPerCycle: number }[]
  let rawOutputs: { slug: string; quantityPerCycle: number }[]

  if (chain.catalogChainSlug) {
    const catalogChain = catalogChainBySlug(chain.catalogChainSlug)
    if (!catalogChain) {
      // Catalog chain not found (stale reference or unloaded catalog): skip
      return null
    }
    cyclesPerMonth = chain.cyclesPerMonth ?? catalogChain.cyclesPerMonth
    rawInputs = chain.inputs ?? catalogChain.inputs
    rawOutputs = chain.outputs ?? catalogChain.outputs
  } else {
    // Fully custom chain: all fields must be present (validated by the API)
    if (chain.cyclesPerMonth == null || !chain.inputs || !chain.outputs) {
      return null
    }
    cyclesPerMonth = chain.cyclesPerMonth
    rawInputs = chain.inputs
    rawOutputs = chain.outputs
  }

  const enrichIO = (io: { slug: string; quantityPerCycle: number }): EngineProductionIO => ({
    slug: io.slug,
    label: resolveLabel(io.slug),
    quantityPerCycle: io.quantityPerCycle,
  })

  return {
    id: chain.id,
    name: chain.name,
    isActive: chain.isActive,
    cyclesPerMonth,
    inputs: rawInputs.map(enrichIO),
    outputs: rawOutputs.map(enrichIO),
  }
}

/**
 * Compute the monthly production projection for a single building.
 * Returns null while the catalog is loading or the building is undefined.
 */
export function useProductionProjection(
  building: ComputedRef<ProductionBuilding | null | undefined>,
): ComputedRef<ProductionBuildingResult | null> {
  const catalogStore = useCatalogStore()

  return computed<ProductionBuildingResult | null>(() => {
    const b = building.value
    const catalog = catalogStore.current
    if (!b || !catalog) return null

    const resolveLabel = catalogStore.resolveIoLabel
    const catalogChainBySlug = catalogStore.productionChainBySlug

    const engineChains: EngineProductionChain[] = b.chains
      .map((chain) => resolveChain(chain, resolveLabel, catalogChainBySlug))
      .filter((c): c is EngineProductionChain => c !== null)

    const engineBuilding: EngineProductionBuilding = {
      id: b.id,
      name: b.name,
      buildingTypeSlug: b.buildingTypeSlug,
      chains: engineChains,
    }

    return productionProjection(engineBuilding)
  })
}
