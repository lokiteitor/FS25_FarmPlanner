<script setup lang="ts">
// features/field-manage/ui/FieldFormModal — create or edit a field ("campo") in
// an AppModal. Form fields: fieldNumber, hectares, crop (select by name_es, value
// = slug, only crops of the active game version), isSilage toggle (disabled +
// validated when the crop has no silage variant), yieldBonus override and
// purchasePrice.
//
// FSD: a feature talks to lower layers via their public APIs only. It submits
// through the field store (entities/field) — never the api directly — and maps
// the crop SLUG (UI value) to the catalog crop id (`cropId`) the backend expects
// (the engine works in slugs, the API in ids). Surfaces field-specific backend
// errors as friendly Spanish messages (lib/errorMessages).
import { computed, reactive, ref, watch } from 'vue'
import { AppButton, AppInput, AppModal, AppSelect, FormField } from '~/shared/ui'
import type { SelectOption } from '~/shared/ui'
import { useCatalogStore } from '~/entities/catalog'
import { useFieldStore } from '~/entities/field'
import type { Field, FieldCreate, FieldUpdate } from '~/entities/field'
import { fieldErrorMessage, fieldScopedError } from '../lib/errorMessages'

const props = defineProps<{
  open: boolean
  /** The farm the field belongs to. */
  farmId: string
  /** Field to edit; null/undefined creates a new field. */
  field?: Field | null
  /**
   * Pre-selected crop SLUG for the CREATE flow (e.g. the "Sembrar" action of the
   * crop-comparison table). Ignored when editing an existing field.
   */
  prefillCropSlug?: string | null
}>()

const emit = defineEmits<{
  close: []
  /** Emitted after a successful create/update with the saved field. */
  saved: [field: Field]
}>()

const catalog = useCatalogStore()
const fieldStore = useFieldStore()

const isEdit = computed(() => Boolean(props.field))
const title = computed(() => (isEdit.value ? 'Editar campo' : 'Nuevo campo'))

// ── Form state (string-backed for the number inputs; parsed on submit) ────────
interface FormShape {
  fieldNumber: string
  hectares: string
  /** Crop SLUG ('' = fallow / no crop). */
  cropSlug: string
  isSilage: boolean
  /** '' = inherit farm default. */
  yieldBonus: string
  /** '' = unrecorded. */
  purchasePrice: string
}

const form = reactive<FormShape>({
  fieldNumber: '',
  hectares: '',
  cropSlug: '',
  isSilage: false,
  yieldBonus: '',
  purchasePrice: '',
})

const fieldErrors = reactive<Record<string, string | undefined>>({})
const generalError = ref('')
const submitting = ref(false)

/** Resolve a crop slug from a catalog crop id (edit prefill). */
function slugForCropId(cropId: string | null | undefined): string {
  if (!cropId) return ''
  return catalog.current?.crops.find((c) => c.id === cropId)?.slug ?? ''
}

/** Resolve the catalog crop id for a slug (submit). null = fallow. */
function cropIdForSlug(slug: string): string | null {
  if (!slug) return null
  return catalog.cropBySlug(slug)?.id ?? null
}

function resetForm() {
  const f = props.field
  form.fieldNumber = f ? String(f.fieldNumber) : ''
  form.hectares = f ? String(f.hectares) : ''
  // Edit: derive from the field's cropId. Create: honor the prefill slug.
  form.cropSlug = f ? slugForCropId(f.cropId) : (props.prefillCropSlug ?? '')
  form.isSilage = f?.isSilage ?? false
  form.yieldBonus = f && f.yieldBonus !== null ? String(f.yieldBonus) : ''
  form.purchasePrice = f && f.purchasePrice !== null ? String(f.purchasePrice) : ''
  clearErrors()
}

function clearErrors() {
  for (const key of Object.keys(fieldErrors)) fieldErrors[key] = undefined
  generalError.value = ''
}

// Re-seed the form whenever the modal opens or the target field/prefill changes.
watch(
  () => [props.open, props.field, props.prefillCropSlug] as const,
  ([open]) => {
    if (open) resetForm()
  },
  { immediate: true },
)

// ── Crop options (active version only), with a fallow option ──────────────────
const cropOptions = computed<SelectOption[]>(() => {
  const crops = catalog.current?.crops ?? []
  return [
    { label: 'Sin cultivo (barbecho)', value: '' },
    ...crops
      .slice()
      .sort((a, b) => a.nameEs.localeCompare(b.nameEs, 'es'))
      .map((c) => ({ label: c.nameEs, value: c.slug })),
  ]
})

/** The silage variant for the selected crop (if any). */
const selectedSilage = computed(() =>
  form.cropSlug ? catalog.silageByCropSlug(form.cropSlug) : undefined,
)

/** Whether the selected crop supports silage (drives the toggle disabled state). */
const silageSupported = computed(() => Boolean(selectedSilage.value))

// When the crop changes to one without silage, clear the silage flag so we never
// submit an invalid (isSilage + unsupported crop) combination.
watch(
  () => form.cropSlug,
  () => {
    if (!silageSupported.value) form.isSilage = false
  },
)

const placeholderBonus = computed(() => {
  const def = catalog.constants?.defaultYieldBonus
  return def !== undefined && def !== null
    ? `Por defecto de la partida (${(def * 100).toFixed(1)}%)`
    : 'Por defecto de la partida'
})

/** Parse a string to a finite number, or null when blank/invalid. */
function parseNumber(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

/** Local (pre-network) validation; returns true when the form is valid. */
function validate(): boolean {
  clearErrors()
  let ok = true

  const fieldNumber = parseNumber(form.fieldNumber)
  if (fieldNumber === null || !Number.isInteger(fieldNumber) || fieldNumber < 1) {
    fieldErrors.fieldNumber = 'Introduce un número de campo válido (entero ≥ 1).'
    ok = false
  }

  const hectares = parseNumber(form.hectares)
  if (hectares === null || hectares <= 0) {
    fieldErrors.hectares = 'Las hectáreas deben ser mayores que 0.'
    ok = false
  }

  if (form.yieldBonus.trim() !== '') {
    const bonus = parseNumber(form.yieldBonus)
    if (bonus === null || bonus < 0 || bonus > 5) {
      fieldErrors.yieldBonus = 'El bonus debe estar entre 0 y 5.'
      ok = false
    }
  }

  if (form.purchasePrice.trim() !== '') {
    const price = parseNumber(form.purchasePrice)
    if (price === null || price < 0) {
      fieldErrors.purchasePrice = 'El precio de compra no puede ser negativo.'
      ok = false
    }
  }

  if (form.isSilage && form.cropSlug && !silageSupported.value) {
    fieldErrors.isSilage = 'El cultivo seleccionado no admite ensilaje.'
    ok = false
  }

  return ok
}

/** Build the create/update body from the parsed form. */
function buildBody(): FieldCreate {
  return {
    fieldNumber: parseNumber(form.fieldNumber) as number,
    hectares: parseNumber(form.hectares) as number,
    cropId: cropIdForSlug(form.cropSlug),
    isSilage: form.isSilage,
    yieldBonus: parseNumber(form.yieldBonus),
    purchasePrice: parseNumber(form.purchasePrice),
  }
}

function applyError(err: unknown) {
  const scoped = fieldScopedError(err)
  if (Object.keys(scoped).length > 0) {
    for (const [key, msg] of Object.entries(scoped)) fieldErrors[key] = msg
  } else {
    generalError.value = fieldErrorMessage(err)
  }
}

async function onSubmit() {
  if (submitting.value) return
  if (!validate()) return
  submitting.value = true
  generalError.value = ''
  try {
    let saved: Field
    if (props.field) {
      saved = await fieldStore.update(props.farmId, props.field.id, buildBody() as FieldUpdate)
    } else {
      saved = await fieldStore.create(props.farmId, buildBody())
    }
    emit('saved', saved)
    emit('close')
  } catch (err) {
    applyError(err)
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
  <AppModal :open="open" :title="title" :persistent="submitting" @close="onClose">
    <form class="field-form" novalidate @submit.prevent="onSubmit">
      <p v-if="generalError" class="field-form__general-error" role="alert">
        {{ generalError }}
      </p>

      <div class="field-form__row">
        <AppInput
          v-model="form.fieldNumber"
          label="Número de campo"
          type="number"
          required
          :disabled="submitting"
          :error="fieldErrors.fieldNumber"
        />
        <AppInput
          v-model="form.hectares"
          label="Hectáreas"
          type="number"
          required
          :disabled="submitting"
          :error="fieldErrors.hectares"
        />
      </div>

      <AppSelect
        v-model="form.cropSlug"
        label="Cultivo"
        :options="cropOptions"
        :disabled="submitting"
        :error="fieldErrors.cropId"
        helper="Sólo cultivos de la versión de la partida"
      />

      <FormField
        label="Ensilaje"
        :error="fieldErrors.isSilage"
        :helper="
          silageSupported
            ? 'Cosechar el cultivo como ensilaje (picado)'
            : 'Este cultivo no admite ensilaje'
        "
      >
        <label class="field-form__toggle">
          <input
            v-model="form.isSilage"
            type="checkbox"
            class="field-form__checkbox"
            :disabled="submitting || !silageSupported"
          />
          <span>Cosechar como ensilaje</span>
        </label>
      </FormField>

      <div class="field-form__row">
        <AppInput
          v-model="form.yieldBonus"
          label="Bonus de rendimiento"
          type="number"
          :disabled="submitting"
          :error="fieldErrors.yieldBonus"
          :placeholder="placeholderBonus"
          helper="Vacío = hereda el valor por defecto de la partida"
        />
        <AppInput
          v-model="form.purchasePrice"
          label="Precio de compra"
          type="number"
          :disabled="submitting"
          :error="fieldErrors.purchasePrice"
          placeholder="Opcional"
        />
      </div>
    </form>

    <template #footer>
      <AppButton variant="ghost" :disabled="submitting" @click="onClose">
        Cancelar
      </AppButton>
      <AppButton :loading="submitting" @click="onSubmit">
        {{ isEdit ? 'Guardar cambios' : 'Crear campo' }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.field-form {
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
    grid-template-columns: 1fr;

    @include respond-to('sm') {
      grid-template-columns: 1fr 1fr;
    }
  }

  &__toggle {
    display: inline-flex;
    align-items: center;
    gap: $space-sm;
    color: var(--text);
    font-size: 0.9375rem;
    cursor: pointer;

    &:has(.field-form__checkbox:disabled) {
      opacity: 0.55;
      cursor: not-allowed;
    }
  }

  &__checkbox {
    width: 1.1rem;
    height: 1.1rem;
    accent-color: var(--primary);
    cursor: inherit;
  }
}
</style>
