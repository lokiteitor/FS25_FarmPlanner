<script setup lang="ts">
// features/field-manage/ui/FieldHarvestModal — prompts the user for the actual
// yield in liters when transitioning a field from 'sown' to 'fallow'. Also
// shows the engine projection for reference. Calls `fieldStore.harvest`, emits
// `harvested` on success, and triggers `harvest-record` store reload in the
// parent.
//
// FSD: feature → entities/field via its public API.
import { computed, ref, watch } from 'vue'
import { AppButton, AppModal } from '~/shared/ui'
import { useFieldStore } from '~/entities/field'
import type { Field } from '~/entities/field'
import { fieldErrorMessage } from '../lib/errorMessages'
import { formatNumber } from '~/shared/lib/format'

const props = defineProps<{
  open: boolean
  farmId: string
  /** Field being harvested; null when the modal is closed. */
  field?: Field | null
  /**
   * Projected yield in liters calculated by the engine at the time the modal
   * opens. Shown as reference; sent to the API as `projectedYieldLiters`.
   * Null if the field had no crop projection available.
   */
  projectedYieldLiters?: number | null
}>()

const emit = defineEmits<{
  close: []
  /** Emitted after a successful harvest. The parent should reload harvest records. */
  harvested: [fieldId: string]
}>()

const fieldStore = useFieldStore()

const actualYield = ref<number | null>(null)
const error = ref('')
const fieldError = ref('')
const submitting = ref(false)

const fieldNumber = computed(() => props.field?.fieldNumber ?? '')

const projectedLabel = computed(() =>
  props.projectedYieldLiters != null
    ? `${formatNumber(props.projectedYieldLiters, 0)} L`
    : null,
)

watch(
  () => props.open,
  (open) => {
    if (open) {
      actualYield.value = null
      error.value = ''
      fieldError.value = ''
    }
  },
)

function validate(): boolean {
  fieldError.value = ''
  if (actualYield.value === null || actualYield.value === undefined) {
    fieldError.value = 'Ingresa el rendimiento real.'
    return false
  }
  if (actualYield.value < 0) {
    fieldError.value = 'El rendimiento no puede ser negativo.'
    return false
  }
  return true
}

async function onConfirm() {
  if (submitting.value || !props.field) return
  if (!validate()) return

  submitting.value = true
  error.value = ''
  const id = props.field.id
  try {
    await fieldStore.harvest(props.farmId, id, {
      actualYieldLiters: actualYield.value!,
      projectedYieldLiters: props.projectedYieldLiters ?? null,
    })
    emit('harvested', id)
    emit('close')
  } catch (err) {
    error.value = fieldErrorMessage(err)
  } finally {
    submitting.value = false
  }
}

function onClose() {
  if (submitting.value) return
  emit('close')
}
</script>

<template>
  <AppModal
    :open="open"
    title="Registrar cosecha"
    :persistent="submitting"
    @close="onClose"
  >
    <div class="harvest-modal">
      <p v-if="error" class="harvest-modal__error" role="alert">{{ error }}</p>

      <p class="harvest-modal__intro">
        Campo <strong>nº {{ fieldNumber }}</strong> — ingresa el rendimiento real
        obtenido en esta cosecha.
      </p>

      <div class="harvest-modal__field">
        <label for="actual-yield" class="harvest-modal__label">
          Rendimiento real (litros) <span class="harvest-modal__required">*</span>
        </label>
        <input
          id="actual-yield"
          v-model.number="actualYield"
          type="number"
          min="0"
          step="1"
          placeholder="Ej. 45000"
          class="harvest-modal__input"
          :class="{ 'harvest-modal__input--error': fieldError }"
          :disabled="submitting"
          @keydown.enter="onConfirm"
        >
        <p v-if="fieldError" class="harvest-modal__field-error">{{ fieldError }}</p>
      </div>

      <p v-if="projectedLabel" class="harvest-modal__projected">
        Rendimiento proyectado: <strong>{{ projectedLabel }}</strong>
      </p>
    </div>

    <template #footer>
      <AppButton variant="ghost" :disabled="submitting" @click="onClose">
        Cancelar
      </AppButton>
      <AppButton :loading="submitting" @click="onConfirm">
        Confirmar cosecha
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.harvest-modal {
  display: flex;
  flex-direction: column;
  gap: $space-md;

  &__intro {
    margin: 0;
    color: var(--text);
    line-height: 1.5;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: $space-xs;
  }

  &__label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
  }

  &__required {
    color: var(--danger);
  }

  &__input {
    width: 100%;
    padding: $space-sm $space-md;
    border: 1.5px solid rgba(255, 255, 255, 0.25);
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.08);
    color: var(--text);
    font-size: 1rem;
    box-sizing: border-box;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: border-color $transition-fast, box-shadow $transition-fast;

    &::placeholder {
      color: var(--text-muted);
    }

    &:focus {
      outline: none;
      border-color: $primary;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3), 0 0 0 3px rgba($primary, 0.2);
    }

    &--error {
      border-color: var(--danger);
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3), 0 0 0 3px rgba(255, 71, 87, 0.2);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  &__field-error {
    margin: 0;
    color: var(--danger);
    font-size: 0.8125rem;
  }

  &__projected {
    margin: 0;
    padding: $space-sm $space-md;
    border-radius: var(--radius-md);
    background: rgba(var(--accent-rgb, 82, 130, 255), 0.08);
    color: var(--text-muted);
    font-size: 0.875rem;
    line-height: 1.5;
  }

  &__error {
    margin: 0;
    padding: $space-sm $space-md;
    border: 1px solid var(--danger);
    border-radius: var(--radius-md);
    background: rgba(255, 71, 87, 0.12);
    color: var(--danger);
    font-size: 0.875rem;
  }
}
</style>
