<script setup lang="ts">
/**
 * production.vue — Manage the active farm's production buildings and view their
 * monthly output projections.
 *
 * Pattern mirrors stables.vue: load via store on mount + watch(farmId), show a
 * DataTable with `#cell-*` slots, open a create/edit modal, render one
 * ProductionBuildingPanel per building.
 */
import { computed, defineComponent, h, onMounted, ref, watch } from 'vue'
import { AppButton, DataTable, GlassCard } from '~/shared/ui'
import type { DataTableColumn } from '~/shared/ui'
import { useFarmStore } from '~/entities/farm'
import { useProductionBuildingStore } from '~/entities/production-building'
import type { ProductionBuilding } from '~/entities/production-building'
import { useCatalogStore } from '~/entities/catalog'
import { ProductionBuildingFormModal, buildingTypeLabel } from '~/features/production-manage'
import {
  ProductionBuildingPanel,
  ProductionSummaryPanel,
  useProductionProjection,
  useProductionFarmSummary,
} from '~/widgets/production-calculator-panel'

const farmStore = useFarmStore()
const buildingStore = useProductionBuildingStore()
const catalogStore = useCatalogStore()

const activeFarmId = computed(() => farmStore.activeFarmId)
const buildings = computed(() => buildingStore.buildings)
const loading = computed(() => buildingStore.loading)
const loadError = computed(() => buildingStore.error)

// ---------------------------------------------------------------------------
// Modal state
// ---------------------------------------------------------------------------
const modalOpen = ref(false)
const editingBuilding = ref<ProductionBuilding | null>(null)
const removeError = ref('')

function openCreate(): void {
  editingBuilding.value = null
  modalOpen.value = true
}

function openEdit(building: ProductionBuilding): void {
  editingBuilding.value = building
  modalOpen.value = true
}

function onSaved(): void {
  modalOpen.value = false
}

async function onDelete(building: ProductionBuilding): Promise<void> {
  if (!activeFarmId.value) return
  const ok =
    typeof window === 'undefined' ||
    window.confirm(`¿Eliminar "${building.name}"?`)
  if (!ok) return

  removeError.value = ''
  try {
    await buildingStore.remove(activeFarmId.value, building.id)
  } catch {
    removeError.value = buildingStore.error ?? 'No se pudo eliminar el edificio.'
  }
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------
async function reload(): Promise<void> {
  const farmId = activeFarmId.value
  if (!farmId) return
  await Promise.all([
    buildingStore.load(farmId).catch(() => {}),
    catalogStore.load(),
  ])
}

onMounted(reload)
watch(activeFarmId, (id) => {
  if (id) reload()
  else buildingStore.reset()
})

// ---------------------------------------------------------------------------
// DataTable columns
// ---------------------------------------------------------------------------
const columns: DataTableColumn[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'buildingTypeSlug', label: 'Tipo' },
  { key: 'activeChains', label: 'Recetas activas', align: 'right', width: '9rem' },
  { key: 'notes', label: 'Notas' },
  { key: 'actions', label: '', align: 'right', width: '12rem' },
]

// ---------------------------------------------------------------------------
// Farm-wide production summary
// ---------------------------------------------------------------------------
const farmSummary = useProductionFarmSummary(buildings)

// ---------------------------------------------------------------------------
// Per-building panel wrapper — each instance gets its own composable so the
// useProductionProjection computed ref tracks the correct building reactively.
// ---------------------------------------------------------------------------
const ProductionBuildingPanelWrapper = defineComponent({
  name: 'ProductionBuildingPanelWrapper',
  props: {
    building: {
      type: Object as () => ProductionBuilding,
      required: true,
    },
  },
  setup(props) {
    const buildingRef = computed(() => props.building)
    const projection = useProductionProjection(buildingRef)

    return () => {
      if (!projection.value) return null
      return h(ProductionBuildingPanel, { projection: projection.value })
    }
  },
})
</script>

<template>
  <div class="production-page">
    <header class="production-page__header">
      <div>
        <h1 class="production-page__title">Producción</h1>
        <p class="production-page__subtitle">
          Gestiona los edificios de producción y calcula sus requerimientos y producción mensual.
        </p>
      </div>
      <AppButton :disabled="!activeFarmId" @click="openCreate">
        Nuevo edificio
      </AppButton>
    </header>

    <GlassCard v-if="!activeFarmId">
      <p class="production-page__empty">
        Selecciona o crea una partida activa para gestionar sus edificios de producción.
      </p>
    </GlassCard>

    <template v-else>
      <p v-if="loadError" class="production-page__error" role="alert">{{ loadError }}</p>
      <p v-if="removeError" class="production-page__error" role="alert">{{ removeError }}</p>

      <!-- Buildings table -->
      <GlassCard flush>
        <template #header>
          <h2 class="production-page__card-title">Edificios de producción</h2>
        </template>

        <DataTable
          :columns="columns"
          :rows="buildings"
          row-key="id"
          caption="Edificios de producción de la partida activa"
        >
          <template #cell-buildingTypeSlug="{ row }">
            {{
              catalogStore.productionBuildingTypeBySlug((row as ProductionBuilding).buildingTypeSlug)?.nameEs
                ?? buildingTypeLabel((row as ProductionBuilding).buildingTypeSlug)
            }}
          </template>

          <template #cell-activeChains="{ row }">
            {{ (row as ProductionBuilding).chains.filter((c) => c.isActive).length }}
          </template>

          <template #cell-notes="{ row }">
            {{ (row as ProductionBuilding).notes ?? '—' }}
          </template>

          <template #cell-actions="{ row }">
            <div class="production-page__actions">
              <AppButton
                variant="ghost"
                size="sm"
                @click="openEdit(row as ProductionBuilding)"
              >
                Editar
              </AppButton>
              <AppButton
                variant="danger"
                size="sm"
                @click="onDelete(row as ProductionBuilding)"
              >
                Eliminar
              </AppButton>
            </div>
          </template>

          <template #empty>
            <span v-if="loading">Cargando edificios…</span>
            <span v-else>Aún no hay edificios. Crea el primero.</span>
          </template>
        </DataTable>
      </GlassCard>

      <!-- Farm-wide summary table -->
      <ProductionSummaryPanel
        v-if="farmSummary && farmSummary.items.length > 0"
        :summary="farmSummary"
      />

      <!-- Per-building production panels -->
      <div v-if="buildings.length > 0" class="production-page__panels">
        <ProductionBuildingPanelWrapper
          v-for="pb in buildings"
          :key="pb.id"
          :building="pb"
        />
      </div>
    </template>

    <!-- Create / Edit modal -->
    <ProductionBuildingFormModal
      v-if="activeFarmId"
      :open="modalOpen"
      :farm-id="activeFarmId"
      :editing="editingBuilding"
      @close="modalOpen = false"
      @saved="onSaved"
    />
  </div>
</template>

<style scoped lang="scss">
.production-page {
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

  &__card-title {
    margin: 0;
    font-size: 1.125rem;
    color: var(--text-strong);
  }

  &__empty {
    margin: 0;
    color: var(--text-muted);
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

  &__actions {
    display: inline-flex;
    gap: $space-sm;
    justify-content: flex-end;
  }

  &__panels {
    display: grid;
    gap: $space-md;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  }
}
</style>
