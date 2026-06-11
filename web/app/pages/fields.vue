<script setup lang="ts">
// pages/fields — manage the fields ("campos") of the active partida. Lists fields
// in a DataTable (número, hectáreas, cultivo name_es, ensilaje, bonus, ingreso
// estimado via the pure engine), with create/edit/delete through the
// features/field-manage modals, plus the crop-comparison widget whose "Sembrar"
// action seeds a new field with the chosen crop.
//
// FSD: a page composes widgets/features/entities via their public APIs only. It
// ensures the active farm + its catalog are loaded, then feeds the catalog + farm
// context into the engine and widgets (ADR-F04 — engine parametrized by catalog).
// Auth is enforced by the global guard; the default layout (sidebar) applies.
import { computed, onMounted, ref } from 'vue'
import { AppButton, DataTable, GlassCard, StatCard } from '~/shared/ui'
import type { DataTableColumn } from '~/shared/ui'
import { useFarmStore } from '~/entities/farm'
import { useCatalogStore } from '~/entities/catalog'
import type { Catalog } from '~/entities/catalog'
import { useFieldStore } from '~/entities/field'
import type { Field } from '~/entities/field'
import { cropProjection } from '~/shared/lib/engine'
import type { EngineCatalog, FarmContext } from '~/shared/lib/engine'
import { formatMoney, formatNumber, formatPercent } from '~/shared/lib/format'
import { FieldDeleteModal, FieldFormModal } from '~/features/field-manage'
import { CropComparisonTable } from '~/widgets/crop-comparison-table'

const farmStore = useFarmStore()
const catalogStore = useCatalogStore()
const fieldStore = useFieldStore()

const bootstrapping = ref(true)
const bootstrapError = ref('')

// ── Modal state ───────────────────────────────────────────────────────────────
const formOpen = ref(false)
const editingField = ref<Field | null>(null)
const prefillCropSlug = ref<string | null>(null)

const deleteOpen = ref(false)
const deletingField = ref<Field | null>(null)

// ── Derived farm/catalog context ──────────────────────────────────────────────
const activeFarm = computed(() => farmStore.activeFarm)
// The entity `Catalog` (crops carry an `id` for id↔slug mapping) is structurally
// assignable to the engine's `EngineCatalog` at the engine call sites.
const catalog = computed<Catalog | null>(() => catalogStore.current)

/** Farm projection context for the engine (difficulty / bonus / sell price). */
const farmContext = computed<FarmContext | null>(() => {
  const f = activeFarm.value
  if (!f) return null
  return {
    difficulty: f.difficulty,
    defaultYieldBonus: f.defaultYieldBonus,
    sellPriceType: f.sellPriceType,
  }
})

const ready = computed(
  () => Boolean(activeFarm.value && catalog.value && farmContext.value),
)

// ── Bootstrap: ensure active farm + its catalog are loaded ────────────────────
async function bootstrap() {
  bootstrapping.value = true
  bootstrapError.value = ''
  try {
    if (!farmStore.hasFarms) await farmStore.loadFarms()
    if (!farmStore.activeFarmId) await farmStore.ensureActive()

    const farm = farmStore.activeFarm
    if (!farm) return // No partida → the template shows the empty state.

    await Promise.all([
      catalogStore.load(farm.gameVersionId),
      fieldStore.load(farm.id),
    ])
  } catch {
    bootstrapError.value = 'No se pudieron cargar los campos. Recarga la página.'
  } finally {
    bootstrapping.value = false
  }
}

onMounted(bootstrap)

// ── Field row projection (uses the pure engine) ───────────────────────────────
interface FieldRow extends Record<string, unknown> {
  id: string
  fieldNumber: number
  hectares: number
  cropName: string
  isSilage: boolean
  effectiveBonus: number
  yieldLiters: number | null
  estimatedIncome: number | null
  raw: Field
}

/** Resolve a crop's catalog slug from its id (fields store cropId). */
function cropSlugForId(cropId: string | null): string | null {
  if (!cropId) return null
  return catalog.value?.crops.find((c) => c.id === cropId)?.slug ?? null
}

const rows = computed<FieldRow[]>(() => {
  const cat = catalog.value
  const farm = farmContext.value
  return fieldStore.fields.map((field) => {
    const slug = cropSlugForId(field.cropId)
    const crop = slug ? cat?.crops.find((c) => c.slug === slug) : undefined
    const effectiveBonus = field.yieldBonus ?? (farm?.defaultYieldBonus ?? 0)

    let estimatedIncome: number | null = null
    let yieldLiters: number | null = null
    if (crop && cat && farm) {
      const projection = cropProjection(
        crop,
        { hectares: field.hectares, yieldBonus: field.yieldBonus, isSilage: field.isSilage },
        farm,
        cat,
      )
      estimatedIncome = projection.grossIncome
      yieldLiters = projection.yieldLiters
    }

    return {
      id: field.id,
      fieldNumber: field.fieldNumber,
      hectares: field.hectares,
      cropName: crop?.nameEs ?? 'Sin cultivo',
      isSilage: field.isSilage,
      effectiveBonus,
      yieldLiters,
      estimatedIncome,
      raw: field,
    }
  })
})

const totalIncome = computed(() =>
  rows.value.reduce((sum, r) => sum + (r.estimatedIncome ?? 0), 0),
)

const columns: DataTableColumn[] = [
  { key: 'fieldNumber', label: 'Nº', align: 'right', width: '4rem' },
  { key: 'hectares', label: 'Hectáreas', align: 'right' },
  { key: 'cropName', label: 'Cultivo' },
  { key: 'isSilage', label: 'Ensilaje', align: 'center' },
  { key: 'effectiveBonus', label: 'Bonus', align: 'right' },
  { key: 'yieldLiters', label: 'Rendimiento', align: 'right' },
  { key: 'estimatedIncome', label: 'Ingreso estimado', align: 'right' },
  { key: 'actions', label: '', align: 'right', width: '10rem' },
]

// ── Actions ───────────────────────────────────────────────────────────────────
function openCreate() {
  editingField.value = null
  prefillCropSlug.value = null
  formOpen.value = true
}

function openEdit(field: Field) {
  editingField.value = field
  prefillCropSlug.value = null
  formOpen.value = true
}

function openDelete(field: Field) {
  deletingField.value = field
  deleteOpen.value = true
}

/** "Sembrar" from the comparison table → open the create form pre-seeded. */
function onSow(slug: string) {
  editingField.value = null
  prefillCropSlug.value = slug
  formOpen.value = true
}

function onFormClose() {
  formOpen.value = false
}

function onDeleteClose() {
  deleteOpen.value = false
}
</script>

<template>
  <div class="fields-page">
    <header class="fields-page__header">
      <div>
        <h1 class="fields-page__title">Campos</h1>
        <p class="fields-page__subtitle">
          {{ activeFarm ? activeFarm.name : 'Gestiona los campos de tu partida' }}
        </p>
      </div>
      <AppButton v-if="ready" @click="openCreate">Nuevo campo</AppButton>
    </header>

    <p v-if="bootstrapError" class="fields-page__error" role="alert">
      {{ bootstrapError }}
    </p>

    <GlassCard v-if="bootstrapping">
      <p class="fields-page__muted">Cargando campos…</p>
    </GlassCard>

    <GlassCard
      v-else-if="!activeFarm"
      title="Sin partida activa"
      subtitle="Selecciona o crea una partida para gestionar campos"
    >
      <p class="fields-page__muted">
        Trabajarás siempre sobre una partida activa. Crea una desde el panel para
        empezar a añadir campos.
      </p>
    </GlassCard>

    <template v-else-if="ready">
      <div class="fields-page__stats">
        <StatCard label="Campos" :value="formatNumber(fieldStore.count)" />
        <StatCard
          label="Hectáreas totales"
          :value="formatNumber(fieldStore.totalHectares, 1)"
          unit="ha"
        />
        <StatCard
          label="Ingreso estimado"
          :value="formatMoney(totalIncome)"
          hint="Suma de campos con cultivo asignado"
        />
      </div>

      <GlassCard
        title="Campos de la partida"
        subtitle="Ingreso estimado calculado con la dificultad de la partida"
      >
        <DataTable :columns="columns" :rows="rows" row-key="id">
          <template #cell-hectares="{ value }">
            {{ formatNumber(value as number, 2) }}
          </template>
          <template #cell-isSilage="{ value }">
            {{ (value as boolean) ? 'Sí' : 'No' }}
          </template>
          <template #cell-effectiveBonus="{ value }">
            {{ formatPercent(value as number) }}
          </template>
          <template #cell-yieldLiters="{ value }">
            {{ value === null ? '—' : `${formatNumber(value as number, 0)} L` }}
          </template>
          <template #cell-estimatedIncome="{ value }">
            {{ value === null ? '—' : formatMoney(value as number) }}
          </template>
          <template #cell-actions="{ row }">
            <div class="fields-page__row-actions">
              <AppButton size="sm" variant="ghost" @click="openEdit((row as FieldRow).raw)">
                Editar
              </AppButton>
              <AppButton size="sm" variant="danger" @click="openDelete((row as FieldRow).raw)">
                Eliminar
              </AppButton>
            </div>
          </template>
          <template #empty>
            <span>No hay campos todavía. Crea el primero con “Nuevo campo”.</span>
          </template>
        </DataTable>
      </GlassCard>

      <CropComparisonTable
        :catalog="catalog as EngineCatalog"
        :farm="farmContext as FarmContext"
        :hectares="fieldStore.fields[0]?.hectares ?? 1"
        @sow="onSow"
      />

      <FieldFormModal
        :open="formOpen"
        :farm-id="activeFarm.id"
        :field="editingField"
        :prefill-crop-slug="prefillCropSlug"
        @close="onFormClose"
      />
      <FieldDeleteModal
        :open="deleteOpen"
        :farm-id="activeFarm.id"
        :field="deletingField"
        @close="onDeleteClose"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.fields-page {
  display: flex;
  flex-direction: column;
  gap: $space-lg;

  &__header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: $space-md;
  }

  &__title {
    margin: 0;
    font-size: 1.75rem;
    color: var(--text-strong);
  }

  &__subtitle {
    margin: $space-xs 0 0;
    color: var(--text-muted);
  }

  &__stats {
    display: grid;
    gap: $space-md;
    grid-template-columns: 1fr;

    @include respond-to('sm') {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  &__row-actions {
    display: inline-flex;
    gap: $space-sm;
    justify-content: flex-end;
  }

  &__muted {
    margin: 0;
    color: var(--text-muted);
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
