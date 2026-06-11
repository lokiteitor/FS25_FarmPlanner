<script setup lang="ts">
// widgets/animal-calculator-panels/ui/AnimalCalculatorPanels — the reusable
// panel set for ONE species: Inputs + Production + Fieldwork/Feed. Parametrized
// by species (which drives per-species field visibility) and driven entirely by
// the pure engine (shared/lib/engine) with the catalog + active farm context.
//
// The reactive `inputs` object is owned by the page (and shared with the
// calculator-config feature) so editing here updates persistence dirty-state.
import { computed } from 'vue'
import { GlassCard } from '~/shared/ui'
import type { Catalog, AnimalSpecies } from '~/entities/catalog'
import type { AnimalConfigInputs } from '~/features/calculator-config'
import type { FarmContext } from '~/shared/lib/engine'
import { SPECIES_META } from '../lib/speciesMeta'
import { useAnimalProjection } from '../model/useAnimalProjection'
import AnimalInputsPanel from './AnimalInputsPanel.vue'
import AnimalProductionPanel from './AnimalProductionPanel.vue'
import AnimalFieldworkPanel from './AnimalFieldworkPanel.vue'

const props = defineProps<{
  species: AnimalSpecies
  /** Reactive config inputs (owned by the page). */
  inputs: AnimalConfigInputs
  catalog: Catalog | null
  farmContext: FarmContext | null
}>()

const meta = computed(() => SPECIES_META[props.species])

const projection = useAnimalProjection(
  props.inputs,
  () => props.catalog,
  () => props.farmContext,
)
</script>

<template>
  <div class="animal-panels">
    <AnimalInputsPanel
      v-if="catalog"
      :inputs="inputs"
      :catalog="catalog"
      :visibility="meta.visibility"
    />

    <template v-if="projection && catalog">
      <AnimalProductionPanel :projection="projection" />
      <AnimalFieldworkPanel :projection="projection" :catalog="catalog" />
    </template>

    <GlassCard v-else title="Sin datos">
      <p class="animal-panels__empty">
        Carga el catálogo y selecciona una partida para calcular la producción.
      </p>
    </GlassCard>
  </div>
</template>

<style scoped lang="scss">
.animal-panels {
  display: flex;
  flex-direction: column;
  gap: $space-lg;

  &__empty {
    margin: 0;
    color: var(--text-muted);
  }
}
</style>
