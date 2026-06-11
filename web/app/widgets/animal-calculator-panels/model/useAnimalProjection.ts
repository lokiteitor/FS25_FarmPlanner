// widgets/animal-calculator-panels/model/useAnimalProjection — derive the
// engine projection from the calculator config inputs + catalog + farm context.
//
// The engine (shared/lib/engine) is PURE and parametrized by
// (catalog, farmContext, inputs). This composable just bridges the persisted
// `AnimalConfigInputs` (a superset carrying linkedStableId/breed) to the engine's
// `AnimalInputs` and recomputes reactively. No stores/network here.

import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { Catalog } from '~/entities/catalog'
// Type-only import from the feature's model module (avoids the feature barrel's
// .vue re-export under the SFC-less vitest config; erased at build time anyway).
import type { AnimalConfigInputs } from '~/features/calculator-config/model/types'
import { animalProjection } from '~/shared/lib/engine'
import type {
  AnimalInputs,
  AnimalProjectionResult,
  EngineCatalog,
  FarmContext,
} from '~/shared/lib/engine'

/**
 * Map persisted config inputs to the engine's input shape. The engine only reads
 * the fields it knows about; `linkedStableId` and `breed` are ignored (they do
 * not affect the FS25 projection model). `yieldBonus` of undefined/null falls
 * back to the farm default inside the engine.
 */
export function toEngineInputs(inputs: AnimalConfigInputs): AnimalInputs {
  const i = inputs as unknown as Record<string, unknown>
  return {
    species: inputs.species,
    count: typeof i.count === 'number' ? i.count : 0,
    yieldBonus: typeof i.yieldBonus === 'number' ? i.yieldBonus : null,
    feedType: i.feedType as AnimalInputs['feedType'],
    provideStraw: i.provideStraw === true,
    grassHarvests: typeof i.grassHarvests === 'number' ? i.grassHarvests : undefined,
    silageCrop: (i.silageCrop as string | null | undefined) ?? null,
    sellCount: typeof i.sellCount === 'number' ? i.sellCount : 0,
    boughtFeedPercent:
      typeof i.boughtFeedPercent === 'number' ? i.boughtFeedPercent : undefined,
    boughtFeedType: i.boughtFeedType as string | undefined,
    grownCrop: i.grownCrop as string | undefined,
    baseCrop: i.baseCrop as string | undefined,
    grainCrop: i.grainCrop as string | undefined,
    proteinCrop: i.proteinCrop as string | undefined,
    rootCrop: i.rootCrop as string | undefined,
  }
}

/** Reactive engine projection for the given inputs / catalog / farm context. */
export function useAnimalProjection(
  inputs: AnimalConfigInputs,
  catalog: ComputedRef<Catalog | null> | (() => Catalog | null),
  farmContext: ComputedRef<FarmContext | null> | (() => FarmContext | null),
): ComputedRef<AnimalProjectionResult | null> {
  const getCatalog = typeof catalog === 'function' ? catalog : () => catalog.value
  const getFarm = typeof farmContext === 'function' ? farmContext : () => farmContext.value

  return computed<AnimalProjectionResult | null>(() => {
    const cat = getCatalog()
    const farm = getFarm()
    if (!cat || !farm) return null
    return animalProjection(toEngineInputs(inputs), farm, cat as unknown as EngineCatalog)
  })
}
