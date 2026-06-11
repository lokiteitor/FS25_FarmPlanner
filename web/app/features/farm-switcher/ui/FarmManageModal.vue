<script setup lang="ts">
// features/farm-switcher/ui/FarmManageModal — create / edit / delete a farm
// ("partida"). Driven by an `open` prop and an optional `farm` (edit when
// present, create when null). All mutations go through the farm store (FSD §8.1);
// the gameVersion list comes from the catalog store. Spanish UI labels.
//
// On a successful create the new farm is emitted via `saved` so the parent can
// activate it; on update the (possibly empty) crop-drop warnings are surfaced.
import { computed, reactive, ref, watch } from 'vue'
import {
  AppButton,
  AppInput,
  AppModal,
  AppSelect,
} from '~/shared/ui'
import type { SelectOption } from '~/shared/ui'
import { useFarmStore } from '~/entities/farm'
import type { Farm, FarmCreate, FarmUpdate } from '~/entities/farm'
import { useCatalogStore } from '~/entities/catalog'
import { DIFFICULTY_OPTIONS, SELL_PRICE_TYPE_OPTIONS } from '../lib/options'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Farm to edit; null/undefined → create mode. */
    farm?: Farm | null
  }>(),
  { farm: null },
)

const emit = defineEmits<{
  close: []
  /** A farm was created. Payload = the new farm. */
  saved: [farm: Farm]
  /** A farm was updated. Payload = backend warnings (e.g. dropped crops). */
  updated: [warnings: string[]]
  /** A farm was deleted. Payload = the deleted farm id. */
  deleted: [farmId: string]
}>()

const farmStore = useFarmStore()
const catalogStore = useCatalogStore()

/** Edit vs create. */
const isEdit = computed(() => Boolean(props.farm))

interface FarmForm {
  name: string
  mapName: string
  difficulty: string
  /** Kept as a string for the text input; parsed on submit. */
  defaultYieldBonus: string
  sellPriceType: string
  gameVersionId: string
}

/** Catalog default yield bonus (0.425) used as the create-form placeholder. */
const DEFAULT_YIELD_BONUS = 0.425

function emptyForm(): FarmForm {
  return {
    name: '',
    mapName: '',
    difficulty: 'normal',
    defaultYieldBonus: '',
    sellPriceType: 'baseline',
    gameVersionId: '',
  }
}

const form = reactive<FarmForm>(emptyForm())
const fieldErrors = reactive<{ name?: string; defaultYieldBonus?: string }>({})
const generalError = ref('')
const confirmingDelete = ref(false)

/** Game-version <select> options (label = version label). */
const gameVersionOptions = computed<SelectOption[]>(() =>
  catalogStore.gameVersions.map((v) => ({
    value: v.id,
    label: v.isActive ? `${v.label} (activa)` : v.label,
  })),
)

const submitting = computed(() => farmStore.saving)

/** Reset the form whenever the modal opens (seeded from `farm` in edit mode). */
function syncForm() {
  fieldErrors.name = undefined
  fieldErrors.defaultYieldBonus = undefined
  generalError.value = ''
  confirmingDelete.value = false

  if (props.farm) {
    form.name = props.farm.name
    form.mapName = props.farm.mapName ?? ''
    form.difficulty = props.farm.difficulty
    form.defaultYieldBonus = String(props.farm.defaultYieldBonus)
    form.sellPriceType = props.farm.sellPriceType
    form.gameVersionId = props.farm.gameVersionId
  } else {
    Object.assign(form, emptyForm())
    // Default to the active version when known.
    const active = catalogStore.gameVersions.find((v) => v.isActive)
    form.gameVersionId = active?.id ?? catalogStore.gameVersions[0]?.id ?? ''
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    // Lazy-load game versions for the select; sync once they (and farm) are ready.
    void catalogStore.loadGameVersions().finally(syncForm)
    syncForm()
  },
  { immediate: true },
)

/** Validate the form, returning true when it can be submitted. */
function validate(): boolean {
  fieldErrors.name = undefined
  fieldErrors.defaultYieldBonus = undefined
  generalError.value = ''

  if (!form.name.trim()) {
    fieldErrors.name = 'El nombre es obligatorio'
  }
  if (form.defaultYieldBonus.trim() !== '') {
    const n = Number(form.defaultYieldBonus)
    if (!Number.isFinite(n) || n < 0 || n > 5) {
      fieldErrors.defaultYieldBonus = 'Debe ser un número entre 0 y 5'
    }
  }
  return !fieldErrors.name && !fieldErrors.defaultYieldBonus
}

/** Parsed yield bonus, or undefined when the field is blank (use the default). */
function parsedYieldBonus(): number | undefined {
  const raw = form.defaultYieldBonus.trim()
  return raw === '' ? undefined : Number(raw)
}

async function onSubmit() {
  if (submitting.value) return
  if (!validate()) return

  try {
    if (props.farm) {
      const body: FarmUpdate = {
        name: form.name.trim(),
        mapName: form.mapName.trim() === '' ? null : form.mapName.trim(),
        difficulty: form.difficulty as FarmUpdate['difficulty'],
        sellPriceType: form.sellPriceType as FarmUpdate['sellPriceType'],
        gameVersionId: form.gameVersionId || undefined,
      }
      const bonus = parsedYieldBonus()
      if (bonus !== undefined) body.defaultYieldBonus = bonus
      const warnings = await farmStore.updateFarm(props.farm.id, body)
      emit('updated', warnings)
      emit('close')
    } else {
      const body: FarmCreate = {
        name: form.name.trim(),
        difficulty: form.difficulty as FarmCreate['difficulty'],
        sellPriceType: form.sellPriceType as FarmCreate['sellPriceType'],
      }
      if (form.mapName.trim() !== '') body.mapName = form.mapName.trim()
      if (form.gameVersionId) body.gameVersionId = form.gameVersionId
      const bonus = parsedYieldBonus()
      if (bonus !== undefined) body.defaultYieldBonus = bonus
      const created = await farmStore.createFarm(body)
      emit('saved', created)
      emit('close')
    }
  } catch {
    generalError.value = farmStore.error ?? 'No se pudo guardar la partida'
  }
}

async function onDelete() {
  if (!props.farm || submitting.value) return
  if (!confirmingDelete.value) {
    confirmingDelete.value = true
    return
  }
  const id = props.farm.id
  try {
    await farmStore.deleteFarm(id)
    emit('deleted', id)
    emit('close')
  } catch {
    generalError.value = farmStore.error ?? 'No se pudo eliminar la partida'
    confirmingDelete.value = false
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
    :title="isEdit ? 'Editar partida' : 'Nueva partida'"
    :persistent="submitting"
    @close="onClose"
  >
    <form class="farm-manage" novalidate @submit.prevent="onSubmit">
      <p v-if="generalError" class="farm-manage__error" role="alert">
        {{ generalError }}
      </p>

      <AppInput
        v-model="form.name"
        label="Nombre"
        placeholder="Mi partida"
        required
        :disabled="submitting"
        :error="fieldErrors.name"
      />

      <AppInput
        v-model="form.mapName"
        label="Mapa"
        placeholder="Nombre del mapa (opcional)"
        :disabled="submitting"
      />

      <AppSelect
        v-model="form.difficulty"
        label="Dificultad"
        :options="DIFFICULTY_OPTIONS"
        :disabled="submitting"
      />

      <AppSelect
        v-model="form.sellPriceType"
        label="Tipo de precio de venta"
        :options="SELL_PRICE_TYPE_OPTIONS"
        :disabled="submitting"
      />

      <AppInput
        v-model="form.defaultYieldBonus"
        label="Bonus de rendimiento por defecto"
        type="number"
        :placeholder="String(DEFAULT_YIELD_BONUS)"
        helper="Entre 0 y 5. Vacío usa el valor por defecto del juego."
        :disabled="submitting"
        :error="fieldErrors.defaultYieldBonus"
      />

      <AppSelect
        v-model="form.gameVersionId"
        label="Versión del juego"
        :options="gameVersionOptions"
        placeholder="Versión activa"
        :disabled="submitting"
        :helper="
          isEdit
            ? 'Cambiar la versión puede descartar cultivos no disponibles.'
            : undefined
        "
      />
    </form>

    <template #footer>
      <AppButton
        v-if="isEdit"
        :variant="confirmingDelete ? 'danger' : 'ghost'"
        size="sm"
        :loading="submitting && confirmingDelete"
        :disabled="submitting"
        @click="onDelete"
      >
        {{ confirmingDelete ? 'Confirmar eliminación' : 'Eliminar' }}
      </AppButton>
      <span class="farm-manage__spacer" />
      <AppButton
        variant="ghost"
        :disabled="submitting"
        @click="onClose"
      >
        Cancelar
      </AppButton>
      <AppButton
        :loading="submitting && !confirmingDelete"
        @click="onSubmit"
      >
        {{ isEdit ? 'Guardar cambios' : 'Crear partida' }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.farm-manage {
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

  &__spacer {
    flex: 1 1 auto;
  }
}
</style>
