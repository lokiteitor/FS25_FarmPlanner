<script setup lang="ts">
// features/calculator-config/ui/CalculatorConfig — the persistence + stable-link
// bar for a species calculator: load status, "vincular establo" select (stables
// of this species), an optional "sincronizar nº de animales" toggle, and
// Save / Reset actions. The reactive `inputs` object is owned by the parent
// (page) so the linked widgets/animal-calculator-panels see the same state.
//
// Components never call the api directly: actions are emitted to the parent,
// which drives them through useCalculatorConfig (FSD §8.1).
import { computed } from 'vue'
import { AppButton, AppSelect, GlassCard } from '~/shared/ui'
import type { SelectOption } from '~/shared/ui'
import type { Stable } from '~/entities/stable'
import type { AnimalConfigInputs } from '../model/types'

const props = withDefaults(
  defineProps<{
    /** Reactive inputs object (owned by the parent). */
    inputs: AnimalConfigInputs
    /** Stables of this species on the active farm (for the link select). */
    stables: Stable[]
    loading?: boolean
    saving?: boolean
    error?: string | null
    /** Whether a config is already saved on the server. */
    hasSavedConfig?: boolean
    /** Whether the inputs differ from the last loaded/saved state. */
    isDirty?: boolean
    /** Whether a farm is active (gates the actions). */
    hasActiveFarm?: boolean
  }>(),
  {
    loading: false,
    saving: false,
    error: null,
    hasSavedConfig: false,
    isDirty: false,
    hasActiveFarm: true,
  },
)

const emit = defineEmits<{
  save: []
  reset: []
  /** Link a stable (or null) and whether to copy its head count. */
  link: [stableId: string | null, syncCount: boolean]
}>()

const linkedStableId = computed<string | null>(
  () => (props.inputs as { linkedStableId?: string | null }).linkedStableId ?? null,
)

// "Sincronizar nº de animales" toggle state (local: only affects future links).
const syncCount = defineModel<boolean>('syncCount', { default: true })

const stableOptions = computed<SelectOption[]>(() => [
  { label: 'Sin vincular', value: '' },
  ...props.stables.map((s) => ({
    label: `${s.name} (${s.currentCount}/${s.maxCapacity})`,
    value: s.id,
  })),
])

function onLinkChange(value: string | number) {
  const id = value === '' ? null : String(value)
  emit('link', id, syncCount.value)
}

const statusText = computed(() => {
  if (props.loading) return 'Cargando configuración…'
  if (!props.hasActiveFarm) return 'Selecciona una partida para guardar la configuración'
  if (props.hasSavedConfig) return props.isDirty ? 'Cambios sin guardar' : 'Configuración guardada'
  return 'Sin configuración guardada (usando valores por defecto)'
})
</script>

<template>
  <GlassCard title="Configuración" subtitle="Guarda y vincula esta calculadora">
    <div class="calc-config">
      <p
        v-if="error"
        class="calc-config__error"
        role="alert"
      >
        {{ error }}
      </p>

      <AppSelect
        :model-value="linkedStableId ?? ''"
        label="Vincular establo"
        helper="Asocia esta calculadora a un establo de la misma especie"
        :options="stableOptions"
        :disabled="saving || loading || stables.length === 0"
        @update:model-value="onLinkChange"
      />

      <label class="calc-config__toggle">
        <input
          v-model="syncCount"
          type="checkbox"
          :disabled="saving || loading"
        >
        <span>Sincronizar nº de animales con el establo</span>
      </label>

      <p class="calc-config__status">{{ statusText }}</p>

      <div class="calc-config__actions">
        <AppButton
          type="button"
          :loading="saving"
          :disabled="!hasActiveFarm || loading"
          @click="emit('save')"
        >
          Guardar
        </AppButton>
        <AppButton
          variant="ghost"
          type="button"
          :disabled="saving || loading || !hasActiveFarm"
          @click="emit('reset')"
        >
          Restablecer
        </AppButton>
      </div>
    </div>
  </GlassCard>
</template>

<style scoped lang="scss">
.calc-config {
  display: flex;
  flex-direction: column;
  gap: $space-md;

  &__error {
    margin: 0;
    padding: $space-sm $space-md;
    border: 1px solid var(--danger);
    border-radius: var(--radius-md);
    background: rgba(255, 71, 87, 0.12);
    color: var(--danger);
    font-size: 0.875rem;
  }

  &__toggle {
    display: flex;
    align-items: center;
    gap: $space-sm;
    color: var(--text);
    font-size: 0.9375rem;
    cursor: pointer;
  }

  &__status {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.8125rem;
  }

  &__actions {
    display: flex;
    gap: $space-sm;
  }
}
</style>
