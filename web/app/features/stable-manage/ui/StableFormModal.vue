<script setup lang="ts">
// features/stable-manage/ui/StableFormModal — create/edit dialog for a stable.
// Fields: name, species (select), maxCapacity, currentCount, plus the dynamic
// species-specific `config` block (feedType/provideStraw/grassHarvests/
// silageCrop/feed-component crop slugs — see lib/species). Submits through the
// stable store (never the api directly, FSD §8.1) and maps backend errors:
//   - DUPLICATE_STABLE_NAME -> name field
//   - COUNT_EXCEEDS_CAPACITY -> currentCount field
//   - others -> general banner
// `editing` switches between POST (create) and PATCH (update). Emits `saved`
// with the persisted stable and `close` to dismiss.
import { computed, reactive, ref, watch } from 'vue'
import {
  AppButton,
  AppInput,
  AppModal,
  AppSelect,
  FormField,
} from '~/shared/ui'
import { useStableStore } from '~/entities/stable'
import type { AnimalSpecies, Stable, StableConfig } from '~/entities/stable'
import { configFieldsFor, speciesOptions } from '../lib/species'
import { stableErrorMessage, stableFieldErrorsFrom } from '../lib/errorMessages'

const props = defineProps<{
  open: boolean
  /** Farm the stable belongs to (required to mutate). */
  farmId: string
  /** When set, the modal edits this stable; otherwise it creates a new one. */
  editing?: Stable | null
}>()

const emit = defineEmits<{
  close: []
  saved: [stable: Stable]
}>()

const store = useStableStore()

interface FormState {
  name: string
  species: AnimalSpecies
  maxCapacity: number | null
  currentCount: number | null
  /** Free-form config values keyed by config key. */
  config: Record<string, unknown>
}

function emptyForm(): FormState {
  return {
    name: '',
    species: 'cow',
    maxCapacity: null,
    currentCount: 0,
    config: {},
  }
}

const form = reactive<FormState>(emptyForm())
const fieldErrors = reactive<{ name?: string; currentCount?: string }>({})
const generalError = ref('')
const submitting = computed(() => store.saving)

const isEditing = computed(() => !!props.editing)
const title = computed(() => (isEditing.value ? 'Editar establo' : 'Nuevo establo'))

/** Config descriptors for the currently selected species. */
const configFields = computed(() => configFieldsFor(form.species))

/** Reset the form to match the `editing` target (or a blank create form). */
function hydrate() {
  const src = props.editing
  if (src) {
    form.name = src.name
    form.species = src.species
    form.maxCapacity = src.maxCapacity
    form.currentCount = src.currentCount
    form.config = { ...src.config }
  } else {
    Object.assign(form, emptyForm())
  }
  fieldErrors.name = undefined
  fieldErrors.currentCount = undefined
  generalError.value = ''
}

// Re-hydrate whenever the modal opens or the edit target changes.
watch(
  () => [props.open, props.editing] as const,
  ([open]) => {
    if (open) hydrate()
  },
  { immediate: true },
)

/** Coerce a config value for a number-kind field. */
function numberConfig(key: string): number | null {
  const v = form.config[key]
  return typeof v === 'number' ? v : null
}

function onNumberConfig(key: string, raw: string) {
  form.config[key] = raw === '' ? undefined : Number(raw)
}

/** Coerce a config value for a text/crop-slug field. */
function textConfig(key: string): string {
  const v = form.config[key]
  return typeof v === 'string' ? v : ''
}

function onTextConfig(key: string, raw: string) {
  form.config[key] = raw === '' ? undefined : raw
}

/** Coerce a config value for a select-kind field. */
function selectConfig(key: string): string {
  const v = form.config[key]
  return typeof v === 'string' ? v : ''
}

function onSelectConfig(key: string, raw: string | number) {
  form.config[key] = raw
}

/** Build the cleaned `config` object (drop empty/undefined values). */
function buildConfig(): StableConfig {
  const out: StableConfig = {}
  for (const def of configFields.value) {
    const v = form.config[def.key]
    if (v === undefined || v === null || v === '') continue
    out[def.key] = v
  }
  return out
}

function clearErrors() {
  fieldErrors.name = undefined
  fieldErrors.currentCount = undefined
  generalError.value = ''
}

/** Local (pre-submit) validation; returns true when the form is valid. */
function validateLocal(): boolean {
  clearErrors()
  let ok = true
  if (!form.name.trim()) {
    fieldErrors.name = 'El nombre es obligatorio.'
    ok = false
  }
  if (form.maxCapacity === null || form.maxCapacity < 1) {
    generalError.value = 'La capacidad máxima debe ser al menos 1.'
    ok = false
  }
  const count = form.currentCount ?? 0
  if (count < 0) {
    fieldErrors.currentCount = 'No puede ser negativo.'
    ok = false
  } else if (form.maxCapacity !== null && count > form.maxCapacity) {
    fieldErrors.currentCount = 'El número actual supera la capacidad máxima.'
    ok = false
  }
  return ok
}

async function onSubmit() {
  if (submitting.value) return
  if (!validateLocal()) return

  const body = {
    name: form.name.trim(),
    species: form.species,
    maxCapacity: form.maxCapacity as number,
    currentCount: form.currentCount ?? 0,
    config: buildConfig(),
  }

  try {
    const stable = props.editing
      ? await store.update(props.farmId, props.editing.id, body)
      : await store.create(props.farmId, body)
    emit('saved', stable)
    emit('close')
  } catch (err) {
    const fields = stableFieldErrorsFrom(err)
    if (fields.name) fieldErrors.name = fields.name
    if (fields.currentCount) fieldErrors.currentCount = fields.currentCount
    const general = stableErrorMessage(err)
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
    <form class="stable-form" novalidate @submit.prevent="onSubmit">
      <p v-if="generalError" class="stable-form__general-error" role="alert">
        {{ generalError }}
      </p>

      <AppInput
        v-model="form.name"
        label="Nombre"
        placeholder="Establo principal"
        required
        :disabled="submitting"
        :error="fieldErrors.name"
      />

      <AppSelect
        v-model="form.species"
        label="Especie"
        :options="speciesOptions()"
        :disabled="submitting"
      />

      <div class="stable-form__row">
        <AppInput
          :model-value="form.maxCapacity"
          label="Capacidad máxima"
          type="number"
          required
          :disabled="submitting"
          @update:model-value="form.maxCapacity = $event === '' ? null : Number($event)"
        />
        <AppInput
          :model-value="form.currentCount"
          label="Animales actuales"
          type="number"
          :disabled="submitting"
          :error="fieldErrors.currentCount"
          @update:model-value="form.currentCount = $event === '' ? null : Number($event)"
        />
      </div>

      <fieldset v-if="configFields.length" class="stable-form__config">
        <legend class="stable-form__config-legend">Configuración específica</legend>

        <template v-for="def in configFields" :key="def.key">
          <!-- Boolean toggle -->
          <FormField v-if="def.kind === 'boolean'" :label="def.label" :helper="def.helper">
            <label class="stable-form__checkbox">
              <input
                type="checkbox"
                :checked="!!form.config[def.key]"
                :disabled="submitting"
                @change="form.config[def.key] = ($event.target as HTMLInputElement).checked"
              />
              <span>Sí</span>
            </label>
          </FormField>

          <!-- Select (e.g. feedType) -->
          <AppSelect
            v-else-if="def.kind === 'select'"
            :model-value="selectConfig(def.key)"
            :label="def.label"
            :helper="def.helper"
            :options="def.options ?? []"
            placeholder="Selecciona…"
            :disabled="submitting"
            @update:model-value="onSelectConfig(def.key, $event)"
          />

          <!-- Number (e.g. grassHarvests) -->
          <AppInput
            v-else-if="def.kind === 'number'"
            :model-value="numberConfig(def.key)"
            :label="def.label"
            :helper="def.helper"
            type="number"
            :disabled="submitting"
            @update:model-value="onNumberConfig(def.key, String($event))"
          />

          <!-- Crop slug / free text -->
          <AppInput
            v-else
            :model-value="textConfig(def.key)"
            :label="def.label"
            :helper="def.helper"
            placeholder="slug del cultivo"
            :disabled="submitting"
            @update:model-value="onTextConfig(def.key, String($event))"
          />
        </template>
      </fieldset>
    </form>

    <template #footer>
      <AppButton variant="ghost" :disabled="submitting" @click="onClose">
        Cancelar
      </AppButton>
      <AppButton :loading="submitting" @click="onSubmit">
        {{ isEditing ? 'Guardar cambios' : 'Crear establo' }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.stable-form {
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

  &__config {
    display: flex;
    flex-direction: column;
    gap: $space-md;
    margin: 0;
    padding: $space-md;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
  }

  &__config-legend {
    padding: 0 $space-xs;
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &__checkbox {
    display: inline-flex;
    align-items: center;
    gap: $space-sm;
    color: var(--text);
    font-size: 0.9375rem;
    cursor: pointer;
  }
}
</style>
