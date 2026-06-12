// Aggregates monthly production results across ALL buildings in the active farm.
// Reuses the same chain-resolution logic as useProductionProjection, but
// operates over a list of buildings and sums inputs/outputs by slug.

import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useCatalogStore } from '~/entities/catalog'
import type { ProductionBuilding, UserChain } from '~/entities/production-building'
import { productionProjection } from '~/shared/lib/engine'
import type {
  EngineProductionBuilding,
  EngineProductionChain,
  EngineProductionIO,
} from '~/shared/lib/engine'

export interface FarmSummaryItem {
  slug: string
  label: string
  inputsPerMonth: number
  outputsPerMonth: number
  /** outputsPerMonth - inputsPerMonth: positive = surplus, negative = net requirement */
  netPerMonth: number
}

export interface FarmProductionSummary {
  items: FarmSummaryItem[]
  totalActiveChains: number
}

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
    if (!catalogChain) return null
    cyclesPerMonth = chain.cyclesPerMonth ?? catalogChain.cyclesPerMonth
    rawInputs = chain.inputs ?? catalogChain.inputs
    rawOutputs = chain.outputs ?? catalogChain.outputs
  } else {
    if (chain.cyclesPerMonth == null || !chain.inputs || !chain.outputs) return null
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

function aggregateAcrossBuildings(
  lines: { slug: string; label?: string; quantityPerMonth: number }[],
  acc: Map<string, { label: string; qty: number }>,
): void {
  for (const line of lines) {
    const existing = acc.get(line.slug)
    if (existing) {
      existing.qty += line.quantityPerMonth
    } else {
      acc.set(line.slug, { label: line.label ?? line.slug, qty: line.quantityPerMonth })
    }
  }
}

export function useProductionFarmSummary(
  buildings: ComputedRef<ProductionBuilding[]>,
): ComputedRef<FarmProductionSummary | null> {
  const catalogStore = useCatalogStore()

  return computed<FarmProductionSummary | null>(() => {
    const catalog = catalogStore.current
    if (!catalog) return null

    const resolveLabel = catalogStore.resolveIoLabel
    const catalogChainBySlug = catalogStore.productionChainBySlug

    const inputsAcc = new Map<string, { label: string; qty: number }>()
    const outputsAcc = new Map<string, { label: string; qty: number }>()
    let totalActiveChains = 0

    for (const b of buildings.value) {
      const engineChains: EngineProductionChain[] = b.chains
        .map((chain) => resolveChain(chain, resolveLabel, catalogChainBySlug))
        .filter((c): c is EngineProductionChain => c !== null)

      const engineBuilding: EngineProductionBuilding = {
        id: b.id,
        name: b.name,
        buildingTypeSlug: b.buildingTypeSlug,
        chains: engineChains,
      }

      const result = productionProjection(engineBuilding)
      totalActiveChains += result.activeChainCount

      aggregateAcrossBuildings(result.totalInputsPerMonth, inputsAcc)
      aggregateAcrossBuildings(result.totalOutputsPerMonth, outputsAcc)
    }

    // Build unified slug set
    const allSlugs = new Set([...inputsAcc.keys(), ...outputsAcc.keys()])
    const items: FarmSummaryItem[] = [...allSlugs]
      .map((slug) => {
        const inp = inputsAcc.get(slug)
        const out = outputsAcc.get(slug)
        const label = inp?.label ?? out?.label ?? slug
        const inputsPerMonth = inp?.qty ?? 0
        const outputsPerMonth = out?.qty ?? 0
        return {
          slug,
          label,
          inputsPerMonth,
          outputsPerMonth,
          netPerMonth: outputsPerMonth - inputsPerMonth,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))

    return { items, totalActiveChains }
  })
}
