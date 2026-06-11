<script setup lang="ts">
// widgets/animal-calculator-panels/ui/AnimalInputsPanel — the species Inputs
// form. Renders only the inputs visible for the species (per SpeciesFieldVisibility)
// and binds them to the reactive `inputs` object (mutated in place). Numeric
// fields coerce the AppInput string value to a number. Crop selects are populated
// from the catalog (silage crops, fieldwork crops, feed-component crops).
//
// PURE presentation: no stores/network. The catalog + visibility are passed in.
import { computed } from 'vue'
import { AppInput, AppSelect, GlassCard } from '~/shared/ui'
import type { SelectOption } from '~/shared/ui'
import type { Catalog } from '~/entities/catalog'
import type { AnimalConfigInputs } from '~/features/calculator-config'
import type { SpeciesFieldVisibility } from '../lib/speciesMeta'
import { COW_BREED_LABELS_ES, FEED_TYPE_LABELS_ES } from '../lib/speciesMeta'

const props = defineProps<{
  inputs: AnimalConfigInputs
  catalog: Catalog
  visibility: SpeciesFieldVisibility
}>()

// Loose accessor: the union is narrowed per-species at runtime via visibility.
const m = computed(() => props.inputs as unknown as Record<string, unknown>)

function bag(): Record<string, unknown> {
  return props.inputs as unknown as Record<string, unknown>
}
function num(key: string): number {
  const v = m.value[key]
  return typeof v === 'number' ? v : 0
}
function setNum(key: string, value: string) {
  const parsed = Number(value)
  bag()[key] = Number.isFinite(parsed) ? parsed : 0
}
function str(key: string): string {
  const v = m.value[key]
  return typeof v === 'string' ? v : ''
}
function setStr(key: string, value: string | number) {
  bag()[key] = String(value)
}
function setBool(key: string, value: boolean) {
  bag()[key] = value
}
function bool(key: string): boolean {
  return m.value[key] === true
}

/** Animal type for this species (for feed options). */
const animalType = computed(() =>
  props.catalog.animalTypes.find((a) => a.species === props.inputs.species),
)

function cropOptions(slugs: string[]): SelectOption[] {
  return slugs.map((slug) => {
    const crop = props.catalog.crops.find((c) => c.slug === slug)
    return { label: crop?.nameEs ?? slug, value: slug }
  })
}

const feedTypeOptions = computed<SelectOption[]>(() => {
  const types = props.visibility.feedTypeSimple
    ? ['tmr', 'simple', 'hay', 'grass']
    : ['tmr', 'hay', 'grass']
  return types.map((t) => ({ label: FEED_TYPE_LABELS_ES[t] ?? t, value: t }))
})

const silageCropOptions = computed<SelectOption[]>(() =>
  cropOptions(animalType.value?.feedOptions.silageCrops ?? []),
)
const grownCropOptions = computed<SelectOption[]>(() =>
  cropOptions(animalType.value?.feedOptions.fieldworkCrops ?? []),
)
const boughtFeedOptions = computed<SelectOption[]>(() =>
  (animalType.value?.feedOptions.boughtFeedTypes ?? []).map((t) => ({
    label: props.catalog.crops.find((c) => c.slug === t)?.nameEs ?? t,
    value: t,
  })),
)

function componentCropOptions(component: string): SelectOption[] {
  return cropOptions(animalType.value?.feedOptions.components?.[component]?.crops ?? [])
}

const breedOptions = computed<SelectOption[]>(() =>
  Object.entries(COW_BREED_LABELS_ES).map(([value, label]) => ({ label, value })),
)
</script>

<template>
  <GlassCard title="Parámetros" subtitle="Datos de la explotación">
    <div class="animal-inputs">
      <!-- Common: head count + yield bonus -->
      <AppInput
        :model-value="num('count')"
        label="Nº de animales"
        type="number"
        @update:model-value="setNum('count', $event)"
      />
      <AppInput
        :model-value="num('yieldBonus')"
        label="Bonus de rendimiento (fracción)"
        type="number"
        helper="Déjalo vacío para usar el valor por defecto de la partida"
        @update:model-value="setNum('yieldBonus', $event)"
      />

      <AppSelect
        v-if="visibility.breed"
        :model-value="str('breed')"
        label="Raza"
        :options="breedOptions"
        @update:model-value="setStr('breed', $event)"
      />

      <AppSelect
        v-if="visibility.feedType"
        :model-value="str('feedType')"
        label="Tipo de alimentación"
        :options="feedTypeOptions"
        @update:model-value="setStr('feedType', $event)"
      />

      <AppSelect
        v-if="visibility.silageCrop"
        :model-value="str('silageCrop')"
        label="Cultivo de ensilaje"
        :options="silageCropOptions"
        @update:model-value="setStr('silageCrop', $event)"
      />

      <AppInput
        v-if="visibility.grassHarvests"
        :model-value="num('grassHarvests')"
        label="Cosechas de hierba / año"
        type="number"
        @update:model-value="setNum('grassHarvests', $event)"
      />

      <!-- Chicken feed -->
      <template v-if="visibility.chickenFeed">
        <AppInput
          :model-value="num('boughtFeedPercent')"
          label="% de pienso comprado"
          type="number"
          helper="0–100; el resto se cultiva"
          @update:model-value="setNum('boughtFeedPercent', $event)"
        />
        <AppSelect
          :model-value="str('boughtFeedType')"
          label="Pienso comprado"
          :options="boughtFeedOptions"
          @update:model-value="setStr('boughtFeedType', $event)"
        />
        <AppSelect
          :model-value="str('grownCrop')"
          label="Cultivo propio"
          :options="grownCropOptions"
          @update:model-value="setStr('grownCrop', $event)"
        />
      </template>

      <!-- Pig/horse feed components -->
      <AppSelect
        v-if="visibility.baseCrop"
        :model-value="str('baseCrop')"
        label="Cultivo base"
        :options="componentCropOptions('base')"
        @update:model-value="setStr('baseCrop', $event)"
      />
      <AppSelect
        v-if="visibility.grainCrop"
        :model-value="str('grainCrop')"
        label="Cultivo de grano"
        :options="componentCropOptions('grain')"
        @update:model-value="setStr('grainCrop', $event)"
      />
      <AppSelect
        v-if="visibility.proteinCrop"
        :model-value="str('proteinCrop')"
        label="Cultivo proteico"
        :options="componentCropOptions('protein')"
        @update:model-value="setStr('proteinCrop', $event)"
      />
      <AppSelect
        v-if="visibility.rootCrop"
        :model-value="str('rootCrop')"
        label="Cultivo de raíces"
        :options="componentCropOptions('root')"
        @update:model-value="setStr('rootCrop', $event)"
      />

      <!-- Sale + straw toggle -->
      <AppInput
        v-if="visibility.sellCount"
        :model-value="num('sellCount')"
        label="Animales vendidos / año"
        type="number"
        @update:model-value="setNum('sellCount', $event)"
      />

      <label v-if="visibility.provideStraw" class="animal-inputs__toggle">
        <input
          type="checkbox"
          :checked="bool('provideStraw')"
          @change="setBool('provideStraw', ($event.target as HTMLInputElement).checked)"
        >
        <span>Proveer paja (bonus de producción)</span>
      </label>
    </div>
  </GlassCard>
</template>

<style scoped lang="scss">
.animal-inputs {
  display: grid;
  gap: $space-md;
  grid-template-columns: 1fr;

  @include respond-to('sm') {
    grid-template-columns: repeat(2, 1fr);
  }

  &__toggle {
    display: flex;
    align-items: center;
    gap: $space-sm;
    color: var(--text);
    font-size: 0.9375rem;
    cursor: pointer;
  }
}
</style>
