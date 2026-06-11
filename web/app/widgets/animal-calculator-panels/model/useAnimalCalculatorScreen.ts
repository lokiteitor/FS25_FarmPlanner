// widgets/animal-calculator-panels/model/useAnimalCalculatorScreen — page-level
// orchestration shared by all 7 species pages. Ensures catalog + farm + stables
// are loaded, builds the engine FarmContext from the active farm, wires the
// calculator-config feature (load/save/reset/link), and exposes everything the
// page template needs. Keeps the panels themselves PURE (they take props).
//
// FSD: widget may import features + entities (downward). Pages render this.

import { computed, onMounted, watch } from 'vue'
import type { ComputedRef } from 'vue'
import { useCatalogStore } from '~/entities/catalog'
import { useFarmStore } from '~/entities/farm'
import { useStableStore } from '~/entities/stable'
import type { AnimalSpecies, Catalog } from '~/entities/catalog'
import type { Stable } from '~/entities/stable'
import { useCalculatorConfig } from '~/features/calculator-config'
import type { UseCalculatorConfig } from '~/features/calculator-config'
import type { FarmContext } from '~/shared/lib/engine'
import { SPECIES_META } from '../lib/speciesMeta'
import type { SpeciesMeta } from '../lib/speciesMeta'

export interface AnimalCalculatorScreen {
  meta: SpeciesMeta
  config: UseCalculatorConfig
  catalog: ComputedRef<Catalog | null>
  farmContext: ComputedRef<FarmContext | null>
  hasActiveFarm: ComputedRef<boolean>
  /** Stables of this species on the active farm (for the link select). */
  speciesStables: ComputedRef<Stable[]>
  /** True while catalog/stables are loading. */
  loadingContext: ComputedRef<boolean>
  onSave: () => Promise<void>
  onReset: () => Promise<void>
  onLink: (stableId: string | null, syncCount: boolean) => void
}

/**
 * Build the screen state for `species`. Loads the catalog for the active farm's
 * game version and the farm's stables, then loads the saved config. Re-runs when
 * the active farm changes.
 */
export function useAnimalCalculatorScreen(species: AnimalSpecies): AnimalCalculatorScreen {
  const catalogStore = useCatalogStore()
  const farmStore = useFarmStore()
  const stableStore = useStableStore()
  const config = useCalculatorConfig(species)

  const meta = SPECIES_META[species]

  const catalog = computed<Catalog | null>(() => catalogStore.current)
  const hasActiveFarm = computed(() => farmStore.activeFarmId !== null)

  const farmContext = computed<FarmContext | null>(() => {
    const farm = farmStore.activeFarm
    if (!farm) return null
    return {
      difficulty: farm.difficulty,
      defaultYieldBonus: farm.defaultYieldBonus,
      sellPriceType: farm.sellPriceType,
    }
  })

  const speciesStables = computed<Stable[]>(() =>
    stableStore.stablesBySpecies(species),
  )

  const loadingContext = computed(
    () => catalogStore.current === null || stableStore.loading,
  )

  /** Ensure catalog + stables + config are loaded for the active farm. */
  async function ensureLoaded(): Promise<void> {
    if (!farmStore.hasFarms) {
      await farmStore.loadFarms().catch(() => undefined)
      await farmStore.ensureActive().catch(() => undefined)
    } else if (farmStore.activeFarmId === null) {
      await farmStore.ensureActive().catch(() => undefined)
    }

    const versionId = farmStore.activeGameVersionId
    await catalogStore.load(versionId ?? undefined).catch(() => undefined)

    const farmId = farmStore.activeFarmId
    if (farmId && stableStore.farmId !== farmId) {
      await stableStore.load(farmId).catch(() => undefined)
    }

    await config.load()
  }

  onMounted(() => {
    void ensureLoaded()
  })

  // Reload stables when the active farm changes (config reloads itself via its
  // own watcher in useCalculatorConfig).
  watch(
    () => farmStore.activeFarmId,
    (farmId) => {
      if (farmId) {
        const versionId = farmStore.activeGameVersionId
        void catalogStore.load(versionId ?? undefined).catch(() => undefined)
        if (stableStore.farmId !== farmId) {
          void stableStore.load(farmId).catch(() => undefined)
        }
      }
    },
  )

  async function onSave(): Promise<void> {
    await config.save().catch(() => undefined)
  }
  async function onReset(): Promise<void> {
    await config.reset().catch(() => undefined)
  }
  function onLink(stableId: string | null, syncCount: boolean): void {
    config.linkStable(stableId, syncCount)
  }

  return {
    meta,
    config,
    catalog,
    farmContext,
    hasActiveFarm,
    speciesStables,
    loadingContext,
    onSave,
    onReset,
    onLink,
  }
}
