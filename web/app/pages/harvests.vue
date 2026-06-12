<script setup lang="ts">
// pages/harvests — historial de cosechas de la partida activa.
//
// Lista todos los registros de cosecha ordenados por más reciente primero.
// Permite filtrar por campo (select en cliente, sin llamada extra al API).
// Muestra estadísticas: total cosechas + litros reales acumulados.
//
// FSD: compone entities (farm, catalog, harvest-record) y shared/ui.
import { computed, onMounted, ref } from 'vue'
import { DataTable, GlassCard, StatCard } from '~/shared/ui'
import type { DataTableColumn } from '~/shared/ui'
import { useFarmStore } from '~/entities/farm'
import { useCatalogStore } from '~/entities/catalog'
import type { Catalog } from '~/entities/catalog'
import { useHarvestRecordStore } from '~/entities/harvest-record'
import type { HarvestRecord } from '~/entities/harvest-record'
import { formatNumber } from '~/shared/lib/format'

const farmStore = useFarmStore()
const catalogStore = useCatalogStore()
const harvestStore = useHarvestRecordStore()

const bootstrapping = ref(true)
const bootstrapError = ref('')
const filterFieldNumber = ref<number | null>(null)

// ── Derived context ───────────────────────────────────────────────────────────

const activeFarm = computed(() => farmStore.activeFarm)
const catalog = computed<Catalog | null>(() => catalogStore.current)

const ready = computed(() => Boolean(activeFarm.value && catalog.value))

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function bootstrap() {
  bootstrapping.value = true
  bootstrapError.value = ''
  try {
    if (!farmStore.hasFarms) await farmStore.loadFarms()
    if (!farmStore.activeFarmId) await farmStore.ensureActive()

    const farm = farmStore.activeFarm
    if (!farm) return

    await Promise.all([
      catalogStore.load(farm.gameVersionId),
      harvestStore.load(farm.id),
    ])
  } catch {
    bootstrapError.value = 'No se pudo cargar el historial. Recarga la página.'
  } finally {
    bootstrapping.value = false
  }
}

onMounted(bootstrap)

// ── Rows ──────────────────────────────────────────────────────────────────────

interface HarvestRow extends Record<string, unknown> {
  id: string
  harvestedAt: string
  fieldNumber: number
  cropName: string
  isSilage: boolean
  actualYieldLiters: number
  projectedYieldLiters: number | null
  diffPercent: number | null
  raw: HarvestRecord
}

function cropNameForId(cropId: string | null): string {
  if (!cropId) return '—'
  return catalog.value?.crops.find((c) => c.id === cropId)?.nameEs ?? '—'
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return isoString
  }
}

const allRows = computed<HarvestRow[]>(() =>
  harvestStore.records.map((r) => {
    const diffPercent =
      r.projectedYieldLiters && r.projectedYieldLiters > 0
        ? (r.actualYieldLiters / r.projectedYieldLiters - 1) * 100
        : null

    return {
      id: r.id,
      harvestedAt: formatDate(r.harvestedAt),
      fieldNumber: r.fieldNumber,
      cropName: cropNameForId(r.cropId),
      isSilage: r.isSilage,
      actualYieldLiters: r.actualYieldLiters,
      projectedYieldLiters: r.projectedYieldLiters,
      diffPercent,
      raw: r,
    }
  }),
)

/** Unique field numbers across all records, for the filter select. */
const fieldNumbers = computed<number[]>(() => {
  const nums = new Set(harvestStore.records.map((r) => r.fieldNumber))
  return Array.from(nums).sort((a, b) => a - b)
})

const rows = computed<HarvestRow[]>(() => {
  if (filterFieldNumber.value === null) return allRows.value
  return allRows.value.filter((r) => r.fieldNumber === filterFieldNumber.value)
})

// ── Columns ───────────────────────────────────────────────────────────────────

const columns: DataTableColumn[] = [
  { key: 'harvestedAt', label: 'Fecha' },
  { key: 'fieldNumber', label: 'Campo', align: 'right', width: '5rem' },
  { key: 'cropName', label: 'Cultivo' },
  { key: 'isSilage', label: 'Ensilaje', align: 'center' },
  { key: 'actualYieldLiters', label: 'Real (L)', align: 'right' },
  { key: 'projectedYieldLiters', label: 'Proyectado (L)', align: 'right' },
  { key: 'diffPercent', label: 'Diferencia', align: 'right' },
]

// ── Resumen por cultivo ───────────────────────────────────────────────────────

interface CropSummaryRow extends Record<string, unknown> {
  cropId: string
  cropName: string
  count: number
  totalLiters: number
  avgLiters: number
}

const cropSummaryRows = computed<CropSummaryRow[]>(() => {
  const map = new Map<string, CropSummaryRow>()
  for (const r of harvestStore.records) {
    const key = r.cropId ?? '__none__'
    const row = map.get(key)
    if (row) {
      row.count++
      row.totalLiters += r.actualYieldLiters
      row.avgLiters = row.totalLiters / row.count
    } else {
      map.set(key, {
        cropId: key,
        cropName: cropNameForId(r.cropId),
        count: 1,
        totalLiters: r.actualYieldLiters,
        avgLiters: r.actualYieldLiters,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalLiters - a.totalLiters)
})

const cropSummaryColumns: DataTableColumn[] = [
  { key: 'cropName', label: 'Cultivo' },
  { key: 'count', label: 'Cosechas', align: 'right', width: '7rem' },
  { key: 'totalLiters', label: 'Total real (L)', align: 'right' },
  { key: 'avgLiters', label: 'Promedio por cosecha (L)', align: 'right' },
]
</script>

<template>
  <div class="harvests-page">
    <header class="harvests-page__header">
      <div>
        <h1 class="harvests-page__title">Historial de cosechas</h1>
        <p class="harvests-page__subtitle">
          {{ activeFarm ? activeFarm.name : 'Registro de rendimiento real por campo' }}
        </p>
      </div>
    </header>

    <p v-if="bootstrapError" class="harvests-page__error" role="alert">
      {{ bootstrapError }}
    </p>

    <GlassCard v-if="bootstrapping">
      <p class="harvests-page__muted">Cargando historial…</p>
    </GlassCard>

    <GlassCard
      v-else-if="!activeFarm"
      title="Sin partida activa"
      subtitle="Selecciona o crea una partida para ver su historial"
    >
      <p class="harvests-page__muted">
        Trabaja siempre sobre una partida activa.
      </p>
    </GlassCard>

    <template v-else-if="ready">
      <div class="harvests-page__stats">
        <StatCard label="Cosechas" :value="formatNumber(harvestStore.count)" />
      </div>

      <GlassCard title="Historial de cosechas">
        <div class="harvests-page__filters">
          <label for="filter-field" class="harvests-page__filter-label">
            Filtrar por campo:
          </label>
          <select
            id="filter-field"
            v-model.number="filterFieldNumber"
            class="harvests-page__filter-select"
          >
            <option :value="null">Todos los campos</option>
            <option v-for="n in fieldNumbers" :key="n" :value="n">
              Campo nº {{ n }}
            </option>
          </select>
        </div>

        <DataTable :columns="columns" :rows="rows" row-key="id">
          <template #cell-fieldNumber="{ value }">
            nº {{ value }}
          </template>
          <template #cell-isSilage="{ value }">
            {{ (value as boolean) ? 'Sí' : 'No' }}
          </template>
          <template #cell-actualYieldLiters="{ value }">
            {{ formatNumber(value as number, 0) }}
          </template>
          <template #cell-projectedYieldLiters="{ value }">
            {{ value === null ? '—' : formatNumber(value as number, 0) }}
          </template>
          <template #cell-diffPercent="{ value }">
            <span
              v-if="value !== null"
              class="harvests-page__diff"
              :class="{
                'harvests-page__diff--positive': (value as number) >= 0,
                'harvests-page__diff--negative': (value as number) < 0,
              }"
            >
              {{ (value as number) >= 0 ? '+' : '' }}{{ formatNumber(value as number, 1) }}%
            </span>
            <span v-else>—</span>
          </template>
          <template #empty>
            <span>
              Aún no hay cosechas registradas.
              Ve a <strong>Campos</strong>, siembra un campo y luego cosecha para empezar.
            </span>
          </template>
        </DataTable>
      </GlassCard>

      <GlassCard title="Rendimiento por cultivo">
        <DataTable :columns="cropSummaryColumns" :rows="cropSummaryRows" row-key="cropId">
          <template #cell-totalLiters="{ value }">
            {{ formatNumber(value as number, 0) }}
          </template>
          <template #cell-avgLiters="{ value }">
            {{ formatNumber(value as number, 0) }}
          </template>
          <template #empty>
            <span>Sin cosechas registradas.</span>
          </template>
        </DataTable>
      </GlassCard>
    </template>
  </div>
</template>

<style scoped lang="scss">
.harvests-page {
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
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    }
  }

  &__filters {
    display: flex;
    align-items: center;
    gap: $space-sm;
    margin-bottom: $space-md;
  }

  &__filter-label {
    font-size: 0.875rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  &__filter-select {
    padding: $space-xs $space-sm;
    border: 1.5px solid rgba(255, 255, 255, 0.25);
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.08);
    color: var(--text);
    font-size: 0.875rem;
    cursor: pointer;
    transition: border-color $transition-fast;

    option {
      background: #1a2230;
      color: var(--text);
    }

    &:focus {
      outline: none;
      border-color: $primary;
    }
  }

  &__diff {
    font-weight: 600;

    &--positive {
      color: #52c41a;
    }

    &--negative {
      color: var(--danger);
    }
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
