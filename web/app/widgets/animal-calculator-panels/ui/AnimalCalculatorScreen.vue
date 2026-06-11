<script setup lang="ts">
// widgets/animal-calculator-panels/ui/AnimalCalculatorScreen — the full screen
// for one species page: title, the calculator-config bar (persistence + stable
// link) and the panel set (Inputs / Production / Fieldwork). Each /animals/*
// page renders this with its species; all data flows through the pure engine
// with the active farm context.
// Import the sibling panel directly (not through the slice's own index.ts):
// re-importing a slice's public API from within the same slice creates a
// chunk-level circular dependency (index.ts re-exports this very component),
// which Rollup warns about. Intra-slice imports must be relative/direct.
import AnimalCalculatorPanels from './AnimalCalculatorPanels.vue'
import { CalculatorConfig } from '~/features/calculator-config'
import type { AnimalSpecies } from '~/entities/catalog'
import { useAnimalCalculatorScreen } from '../model/useAnimalCalculatorScreen'

const props = defineProps<{
  species: AnimalSpecies
}>()

const screen = useAnimalCalculatorScreen(props.species)
const { meta, config, catalog, farmContext, hasActiveFarm, speciesStables } = screen
</script>

<template>
  <div class="animal-screen">
    <header class="animal-screen__header">
      <h1 class="animal-screen__title">Calculadora de {{ meta.labelEs }}</h1>
      <p class="animal-screen__subtitle">
        Producción, alimentación y rentabilidad de la cabaña
      </p>
    </header>

    <div class="animal-screen__layout">
      <div class="animal-screen__main">
        <AnimalCalculatorPanels
          :species="species"
          :inputs="config.inputs"
          :catalog="catalog"
          :farm-context="farmContext"
        />
      </div>

      <aside class="animal-screen__aside">
        <CalculatorConfig
          :inputs="config.inputs"
          :stables="speciesStables"
          :loading="config.loading.value"
          :saving="config.saving.value"
          :error="config.error.value"
          :has-saved-config="config.hasSavedConfig.value"
          :is-dirty="config.isDirty.value"
          :has-active-farm="hasActiveFarm"
          @save="screen.onSave"
          @reset="screen.onReset"
          @link="screen.onLink"
        />
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
.animal-screen {
  display: flex;
  flex-direction: column;
  gap: $space-lg;

  &__header {
    display: flex;
    flex-direction: column;
    gap: $space-xs;
  }

  &__title {
    margin: 0;
    font-size: 1.75rem;
    color: var(--text-strong);
  }

  &__subtitle {
    margin: 0;
    color: var(--text-muted);
  }

  &__layout {
    display: grid;
    gap: $space-lg;
    grid-template-columns: 1fr;

    @include respond-to('lg') {
      grid-template-columns: 1fr 22rem;
      align-items: start;
    }
  }

  &__main {
    min-width: 0;
  }

  &__aside {
    @include respond-to('lg') {
      position: sticky;
      top: $space-lg;
    }
  }
}
</style>
