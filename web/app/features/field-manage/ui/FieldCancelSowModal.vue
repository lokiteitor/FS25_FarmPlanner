<script setup lang="ts">
// features/field-manage/ui/FieldCancelSowModal — confirm cancellation of a
// sowing without recording a harvest. Calls `fieldStore.cancelSow`, emits
// `cancelled` on success.
//
// FSD: feature → entities/field via its public API.
import { computed, ref, watch } from 'vue'
import { AppButton, AppModal } from '~/shared/ui'
import { useFieldStore } from '~/entities/field'
import type { Field } from '~/entities/field'
import { fieldErrorMessage } from '../lib/errorMessages'

const props = defineProps<{
  open: boolean
  farmId: string
  /** Field whose sowing is being cancelled; null when the modal is closed. */
  field?: Field | null
}>()

const emit = defineEmits<{
  close: []
  cancelled: [fieldId: string]
}>()

const fieldStore = useFieldStore()

const error = ref('')
const submitting = ref(false)

const fieldNumber = computed(() => props.field?.fieldNumber ?? '')

watch(
  () => props.open,
  (open) => {
    if (open) error.value = ''
  },
)

async function onConfirm() {
  if (submitting.value || !props.field) return
  submitting.value = true
  error.value = ''
  const id = props.field.id
  try {
    await fieldStore.cancelSow(props.farmId, id)
    emit('cancelled', id)
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
    title="Cancelar siembra"
    :persistent="submitting"
    @close="onClose"
  >
    <div class="cancel-sow">
      <p v-if="error" class="cancel-sow__error" role="alert">{{ error }}</p>
      <p class="cancel-sow__text">
        ¿Seguro que quieres cancelar la siembra del campo
        <strong>nº {{ fieldNumber }}</strong>?
      </p>
      <p class="cancel-sow__hint">
        No se registrará ninguna cosecha. El cultivo asignado se mantendrá para
        que puedas volver a sembrar cuando quieras.
      </p>
    </div>

    <template #footer>
      <AppButton variant="ghost" :disabled="submitting" @click="onClose">
        Volver
      </AppButton>
      <AppButton variant="danger" :loading="submitting" @click="onConfirm">
        Cancelar siembra
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.cancel-sow {
  display: flex;
  flex-direction: column;
  gap: $space-md;

  &__text {
    margin: 0;
    color: var(--text);
    line-height: 1.5;
  }

  &__hint {
    margin: 0;
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
