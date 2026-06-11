// features/calculator-config/model/useCalculatorConfig — composable that owns
// the persisted calculator config for one species on the active farm: load the
// saved inputs (or catalog defaults on 404), save (PUT), reset (DELETE) and the
// "vincular establo" link. PURE orchestration over stores + the feature api;
// components render the returned reactive state.
//
// FSD: feature depends on entities (catalog/farm/stable, via their public APIs)
// and shared. It never imports widgets/pages.

import { computed, reactive, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useCatalogStore } from '~/entities/catalog'
import { useFarmStore } from '~/entities/farm'
import { useStableStore } from '~/entities/stable'
import { isApiError } from '~/shared/api'
import type { AnimalSpecies } from '~/entities/catalog'
import * as animalConfigApi from '../api/animalConfigApi'
import { defaultInputsFor } from './defaults'
import type { AnimalConfigInputs } from './types'

function errorMessage(err: unknown): string {
  if (isApiError(err)) return err.message
  if (err instanceof Error) return err.message
  return 'Error inesperado'
}

export interface UseCalculatorConfig {
  /** The reactive inputs object (v-model target for the panels). */
  inputs: AnimalConfigInputs
  /** True while loading the saved config. */
  loading: Ref<boolean>
  /** True while a save/reset/link mutation is in flight. */
  saving: Ref<boolean>
  /** Last error message, or null. */
  error: Ref<string | null>
  /** True once a config has been saved on the server for this species. */
  hasSavedConfig: Ref<boolean>
  /** Whether the inputs differ from the last loaded/saved snapshot. */
  isDirty: Ref<boolean>
  /** Load the saved config (or catalog defaults) into `inputs`. */
  load: () => Promise<void>
  /** Persist the current inputs (PUT upsert). */
  save: () => Promise<void>
  /** Delete the saved config and restore catalog defaults. */
  reset: () => Promise<void>
  /** Link a stable (and optionally copy its head count into `inputs.count`). */
  linkStable: (stableId: string | null, syncCount: boolean) => void
}

/**
 * Manage the calculator config for `species`. Reads the active farm + catalog
 * from their stores; the caller is responsible for having loaded the catalog and
 * farm beforehand (the page does this). Re-loads when the active farm changes.
 */
export function useCalculatorConfig(species: AnimalSpecies): UseCalculatorConfig {
  const catalogStore = useCatalogStore()
  const farmStore = useFarmStore()
  const stableStore = useStableStore()

  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const hasSavedConfig = ref(false)

  // Reactive inputs object. Mutated in place so v-model bindings stay stable.
  const inputs = reactive(seedDefaults()) as AnimalConfigInputs
  // JSON snapshot of the last loaded/saved state, for dirty tracking.
  const snapshot = ref<string>(JSON.stringify(inputs))

  const isDirty = computed(() => JSON.stringify(inputs) !== snapshot.value)

  function seedDefaults(): AnimalConfigInputs {
    const catalog = catalogStore.current
    if (!catalog) return { species, count: 0, linkedStableId: null } as AnimalConfigInputs
    return defaultInputsFor(species, catalog)
  }

  /** Replace every key of the reactive `inputs` with `next`. */
  function applyInputs(next: AnimalConfigInputs): void {
    const target = inputs as unknown as Record<string, unknown>
    for (const key of Object.keys(target)) Reflect.deleteProperty(target, key)
    Object.assign(target, next)
    snapshot.value = JSON.stringify(inputs)
  }

  /**
   * Merge a saved (or fetched) inputs object over the catalog defaults. Both are
   * members of the discriminated `AnimalConfigInputs` union for the SAME species,
   * so the merge is sound; TS over-widens spreads of unions, hence the cast.
   */
  function mergeOverDefaults(saved: AnimalConfigInputs): AnimalConfigInputs {
    return { ...seedDefaults(), ...saved } as AnimalConfigInputs
  }

  async function load(): Promise<void> {
    const farmId = farmStore.activeFarmId
    if (!farmId) {
      applyInputs(seedDefaults())
      hasSavedConfig.value = false
      return
    }
    loading.value = true
    error.value = null
    try {
      const config = await animalConfigApi.getOne(farmId, species)
      if (config) {
        // Merge over defaults so any newly-added field has a sane value.
        applyInputs(mergeOverDefaults(config.inputs))
        hasSavedConfig.value = true
      } else {
        applyInputs(seedDefaults())
        hasSavedConfig.value = false
      }
    } catch (err) {
      error.value = errorMessage(err)
      applyInputs(seedDefaults())
      hasSavedConfig.value = false
    } finally {
      loading.value = false
    }
  }

  async function save(): Promise<void> {
    const farmId = farmStore.activeFarmId
    if (!farmId) {
      error.value = 'No hay partida activa'
      return
    }
    saving.value = true
    error.value = null
    try {
      const saved = await animalConfigApi.upsert(
        farmId,
        species,
        JSON.parse(JSON.stringify(inputs)) as AnimalConfigInputs,
      )
      applyInputs(mergeOverDefaults(saved.inputs))
      hasSavedConfig.value = true
    } catch (err) {
      error.value = errorMessage(err)
      throw err
    } finally {
      saving.value = false
    }
  }

  async function reset(): Promise<void> {
    const farmId = farmStore.activeFarmId
    if (!farmId) {
      applyInputs(seedDefaults())
      hasSavedConfig.value = false
      return
    }
    saving.value = true
    error.value = null
    try {
      if (hasSavedConfig.value) {
        await animalConfigApi.remove(farmId, species)
      }
      applyInputs(seedDefaults())
      hasSavedConfig.value = false
    } catch (err) {
      error.value = errorMessage(err)
      throw err
    } finally {
      saving.value = false
    }
  }

  function linkStable(stableId: string | null, syncCount: boolean): void {
    ;(inputs as { linkedStableId?: string | null }).linkedStableId = stableId
    if (syncCount && stableId) {
      const stable = stableStore.stableById(stableId)
      if (stable) inputs.count = stable.currentCount
    }
  }

  // Reload when the active farm changes (different saved configs per farm).
  watch(
    () => farmStore.activeFarmId,
    () => {
      void load()
    },
  )

  return {
    inputs,
    loading,
    saving,
    error,
    hasSavedConfig,
    isDirty,
    load,
    save,
    reset,
    linkStable,
  }
}
