<script setup lang="ts">
// features/field-manage/ui/FieldDeleteModal — confirm + perform deletion of a
// field. Submits through the field store (entities/field), surfaces any backend
// error as a Spanish banner, and emits `deleted` on success.
//
// FSD: feature -> entities/field via its public API (never the api directly).
import { computed, ref, watch } from 'vue'
import { AppButton, AppModal } from '~/shared/ui'
import { useFieldStore } from '~/entities/field'
import type { Field } from '~/entities/field'
import { fieldErrorMessage } from '../lib/errorMessages'

const props = defineProps<{
  open: boolean
  farmId: string
  /** Field to delete; null when the modal is closed. */
  field?: Field | null
}>()

const emit = defineEmits<{
  close: []
  deleted: [fieldId: string]
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
    await fieldStore.remove(props.farmId, id)
    emit('deleted', id)
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
    title="Eliminar campo"
    :persistent="submitting"
    @close="onClose"
  >
    <div class="field-delete">
      <p v-if="error" class="field-delete__error" role="alert">{{ error }}</p>
      <p class="field-delete__text">
        ¿Seguro que quieres eliminar el campo
        <strong>nº {{ fieldNumber }}</strong>? Esta acción no se puede deshacer.
      </p>
    </div>

    <template #footer>
      <AppButton variant="ghost" :disabled="submitting" @click="onClose">
        Cancelar
      </AppButton>
      <AppButton variant="danger" :loading="submitting" @click="onConfirm">
        Eliminar
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.field-delete {
  display: flex;
  flex-direction: column;
  gap: $space-md;

  &__text {
    margin: 0;
    color: var(--text);
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
