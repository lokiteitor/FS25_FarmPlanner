// shared/lib/engine/productionEngine — pure production chain calculations.
//
// Parametrized ONLY by the building and its resolved chains.
// No stores, no network, no EngineCatalog, no FarmContext.
//
// Key mechanic: when N chains are active in a building, the building's
// total monthly cycle capacity is split equally among them.
//   effectiveCycles(chain) = chain.cyclesPerMonth / activeChainCount
// The caller (the widget composable) resolves catalog overrides BEFORE calling
// the engine; every chain passed here has concrete numeric values.
//
// All exported helpers are individually testable with inline data.

import type {
  EngineProductionBuilding,
  EngineProductionChain,
  EngineProductionIO,
  ProductionChainResult,
  ProductionBuildingResult,
} from './types'

// ---------------------------------------------------------------------------
// Exported helpers (unit-testable independently)
// ---------------------------------------------------------------------------

/** Chains in a building that participate in cycle-split and production. */
export function activeChains(
  building: EngineProductionBuilding,
): EngineProductionChain[] {
  return building.chains.filter((c) => c.isActive)
}

/**
 * Effective cycles per month for one chain when it shares the building with
 * `activeCount` active chains. Returns 0 when activeCount is 0.
 */
export function effectiveCyclesPerMonth(
  cyclesPerMonth: number,
  activeCount: number,
): number {
  if (activeCount === 0) return 0
  return cyclesPerMonth / activeCount
}

/** Monthly quantity for a single IO line (effective cycles × qty per cycle). */
export function quantityPerMonth(
  io: EngineProductionIO,
  effectiveCycles: number,
): number {
  return io.quantityPerCycle * effectiveCycles
}

// ---------------------------------------------------------------------------
// Chain projection (single chain inside its building context)
// ---------------------------------------------------------------------------

/** Project one chain's monthly inputs and outputs. */
export function chainProjection(
  chain: EngineProductionChain,
  activeCount: number,
): ProductionChainResult {
  const effCycles = chain.isActive
    ? effectiveCyclesPerMonth(chain.cyclesPerMonth, activeCount)
    : 0

  const inputsPerMonth = chain.inputs.map((io) => ({
    slug: io.slug,
    label: io.label,
    quantityPerMonth: quantityPerMonth(io, effCycles),
  }))

  const outputsPerMonth = chain.outputs.map((io) => ({
    slug: io.slug,
    label: io.label,
    quantityPerMonth: quantityPerMonth(io, effCycles),
  }))

  return {
    chainId: chain.id,
    name: chain.name,
    isActive: chain.isActive,
    effectiveCyclesPerMonth: effCycles,
    inputsPerMonth,
    outputsPerMonth,
  }
}

// ---------------------------------------------------------------------------
// Building projection (all chains + totals)
// ---------------------------------------------------------------------------

/**
 * Aggregate monthly inputs and outputs by slug from a list of chain results.
 * Sums quantities across chains that share the same slug (e.g. two chains in
 * the same bakery may both consume flour). Returns a stable array sorted by
 * slug for a predictable display order.
 */
function aggregateBySlug(
  lines: { slug: string; label?: string; quantityPerMonth: number }[],
): { slug: string; label?: string; quantityPerMonth: number }[] {
  const bySlug = new Map<
    string,
    { slug: string; label?: string; quantityPerMonth: number }
  >()
  for (const line of lines) {
    const existing = bySlug.get(line.slug)
    if (existing) {
      existing.quantityPerMonth += line.quantityPerMonth
    } else {
      bySlug.set(line.slug, { ...line })
    }
  }
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug))
}

/**
 * Project the monthly production of a building — the main entry point.
 *
 * All chains must have their overrides already resolved (cyclesPerMonth,
 * inputs, outputs are concrete numbers / arrays, not null).
 */
export function productionProjection(
  building: EngineProductionBuilding,
): ProductionBuildingResult {
  const active = activeChains(building)
  const activeCount = active.length

  const chainResults = building.chains.map((chain) =>
    chainProjection(chain, activeCount),
  )

  const allInputs = chainResults.flatMap((r) => r.inputsPerMonth)
  const allOutputs = chainResults.flatMap((r) => r.outputsPerMonth)

  return {
    buildingId: building.id,
    buildingName: building.name,
    buildingTypeSlug: building.buildingTypeSlug,
    activeChainCount: activeCount,
    chains: chainResults,
    totalInputsPerMonth: aggregateBySlug(allInputs),
    totalOutputsPerMonth: aggregateBySlug(allOutputs),
  }
}
