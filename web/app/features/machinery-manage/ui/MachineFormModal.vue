<script setup lang="ts">
// features/machinery-manage/ui/MachineFormModal — create/edit dialog for a
// machine. Fields: name, workingWidthM, workingSpeedKmh; it live-previews the
// theoretical capacity (ha/h = width*speed/10). Submits through the machinery
// store (never the api directly, FSD §8.1) and maps 422 details onto fields.
// `editing` switches between POST (create) and PATCH (update). Emits `saved`
// with the persisted machine and `close`.
import { computed, reactive, ref, watch } from 'vue'
import { AppButton, AppInput, AppModal } from '~/shared/ui'
import { useMachineryStore } from '~/entities/machinery'
import type { Machine } from '~/entities/machinery'
import { formatCapacity } from '../lib/capacity'
import { machineErrorMessage, machineFieldErrorsFrom } from '../lib/errorMessages'

const props = defineProps<{
  open: boolean
  /** Farm the machine belongs to (required to mutate). */
  farmId: string
  /** When set, the modal edits this machine; otherwise it creates a new one. */
  editing?: Machine | null
}>()

const emit = defineEmits<{
  close: []
  saved: [machine: Machine]
}>()

const store = useMachineryStore()

interface FormState {
  name: string
  workingWidthM: number | null
  workingSpeedKmh: number | null
}

function emptyForm(): FormState {
  return { name: '', workingWidthM: null, workingSpeedKmh: null }
}

const form = reactive<FormState>(emptyForm())
const fieldErrors = reactive<{
  name?: string
  workingWidthM?: string
  workingSpeedKmh?: string
}>({})
const generalError = ref('')
const submitting = computed(() => store.saving)

const isEditing = computed(() => !!props.editing)
const title = computed(() => (isEditing.value ? 'Editar máquina' : 'Nueva máquina'))

/** Live theoretical-capacity preview (ha/h). */
const capacityPreview = computed(() =>
  formatCapacity(form.workingWidthM ?? 0, form.workingSpeedKmh ?? 0),
)

function hydrate() {
  const src = props.editing
  if (src) {
    form.name = src.name
    form.workingWidthM = src.workingWidthM
    form.workingSpeedKmh = src.workingSpeedKmh
  } else {
    Object.assign(form, emptyForm())
  }
  fieldErrors.name = undefined
  fieldErrors.workingWidthM = undefined
  fieldErrors.workingSpeedKmh = undefined
  generalError.value = ''
}

watch(
  () => [props.open, props.editing] as const,
  ([open]) => {
    if (open) hydrate()
  },
  { immediate: true },
)

function clearErrors() {
  fieldErrors.name = undefined
  fieldErrors.workingWidthM = undefined
  fieldErrors.workingSpeedKmh = undefined
  generalError.value = ''
}

/** Local validation (mirrors openapi exclusiveMinimum:0). */
function validateLocal(): boolean {
  clearErrors()
  let ok = true
  if (!form.name.trim()) {
    fieldErrors.name = 'El nombre es obligatorio.'
    ok = false
  }
  if (form.workingWidthM === null || form.workingWidthM <= 0) {
    fieldErrors.workingWidthM = 'Debe ser mayor que 0.'
    ok = false
  }
  if (form.workingSpeedKmh === null || form.workingSpeedKmh <= 0) {
    fieldErrors.workingSpeedKmh = 'Debe ser mayor que 0.'
    ok = false
  }
  return ok
}

async function onSubmit() {
  if (submitting.value) return
  if (!validateLocal()) return

  const body = {
    name: form.name.trim(),
    workingWidthM: form.workingWidthM as number,
    workingSpeedKmh: form.workingSpeedKmh as number,
  }

  try {
    const machine = props.editing
      ? await store.update(props.farmId, props.editing.id, body)
      : await store.create(props.farmId, body)
    emit('saved', machine)
    emit('close')
  } catch (err) {
    const fields = machineFieldErrorsFrom(err)
    if (fields.name) fieldErrors.name = fields.name
    if (fields.workingWidthM) fieldErrors.workingWidthM = fields.workingWidthM
    if (fields.workingSpeedKmh) fieldErrors.workingSpeedKmh = fields.workingSpeedKmh
    const general = machineErrorMessage(err)
    if (general) generalError.value = general
  }
}

function onClose() {
  if (submitting.value) return
  emit('close')
}
</script>

<template>
  <AppModal :open="open" :title="title" :persistent="submitting" @close="onClose">
    <form class="machine-form" novalidate @submit.prevent="onSubmit">
      <p v-if="generalError" class="machine-form__general-error" role="alert">
        {{ generalError }}
      </p>

      <AppInput
        v-model="form.name"
        label="Nombre"
        placeholder="Sembradora 6m"
        required
        :disabled="submitting"
        :error="fieldErrors.name"
      />

      <div class="machine-form__row">
        <AppInput
          :model-value="form.workingWidthM"
          label="Anchura de trabajo (m)"
          type="number"
          required
          :disabled="submitting"
          :error="fieldErrors.workingWidthM"
          @update:model-value="form.workingWidthM = $event === '' ? null : Number($event)"
        />
        <AppInput
          :model-value="form.workingSpeedKmh"
          label="Velocidad de trabajo (km/h)"
          type="number"
          required
          :disabled="submitting"
          :error="fieldErrors.workingSpeedKmh"
          @update:model-value="form.workingSpeedKmh = $event === '' ? null : Number($event)"
        />
      </div>

      <p class="machine-form__capacity">
        Capacidad teórica:
        <strong>{{ capacityPreview }}</strong>
      </p>
    </form>

    <template #footer>
      <AppButton variant="ghost" :disabled="submitting" @click="onClose">
        Cancelar
      </AppButton>
      <AppButton :loading="submitting" @click="onSubmit">
        {{ isEditing ? 'Guardar cambios' : 'Crear máquina' }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.machine-form {
  display: flex;
  flex-direction: column;
  gap: $space-md;

  &__general-error {
    margin: 0;
    padding: $space-sm $space-md;
    border: 1px solid var(--danger);
    border-radius: var(--radius-md);
    background: rgba(255, 71, 87, 0.12);
    color: var(--danger);
    font-size: 0.875rem;
  }

  &__row {
    display: grid;
    gap: $space-md;
    grid-template-columns: 1fr 1fr;
  }

  &__capacity {
    margin: 0;
    padding: $space-sm $space-md;
    border-radius: var(--radius-md);
    background: var(--glass-bg);
    color: var(--text-muted);
    font-size: 0.9375rem;

    strong {
      color: var(--text-strong);
    }
  }
}
</style>
