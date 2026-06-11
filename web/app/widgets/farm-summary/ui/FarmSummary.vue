<script setup lang="ts">
// widgets/farm-summary/ui/FarmSummary — the dashboard summary. Pure
// presentational: it reads the farm/field/stable/catalog stores and derives the
// model with buildFarmSummary (pure). It does NOT load data — the host page is
// responsible for ensuring the active farm, catalog, fields and stables are
// loaded (and reloaded when the active farm changes).
//
// KPIs that need no catalog (field/stable counts, hectares, animals) always
// render. Crop economics need the active catalog; when it is not loaded yet the
// income KPI/table show a "—" placeholder instead of wrong numbers.
import { computed } from 'vue'
import { GlassCard, StatCard, DataTable } from '~/shared/ui'
import type { DataTableColumn } from '~/shared/ui'
import { useFarmStore } from '~/entities/farm'
import { useFieldStore } from '~/entities/field'
import { useStableStore } from '~/entities/stable'
import { useCatalogStore } from '~/entities/catalog'
import type { FarmContext } from '~/shared/lib/engine'
import { buildFarmSummary } from '../lib/summary'
import type { CropDistributionRow } from '../lib/summary'
import {
  formatCurrency,
  formatHectares,
  formatInteger,
  speciesLabel,
} from '../lib/format'

const farmStore = useFarmStore()
const fieldStore = useFieldStore()
const stableStore = useStableStore()
const catalogStore = useCatalogStore()

const activeFarm = computed(() => farmStore.activeFarm)

/** Farm context for the engine, derived from the active farm. */
const farmContext = computed<FarmContext | null>(() => {
  const farm = activeFarm.value
  if (!farm) return null
  return {
    difficulty: farm.difficulty,
    defaultYieldBonus: farm.defaultYieldBonus,
    sellPriceType: farm.sellPriceType,
  }
})

/** True once the catalog needed for crop economics is available. */
const catalogReady = computed(() => catalogStore.current !== null)

const summary = computed(() => {
  const ctx = farmContext.value
  const catalog = catalogStore.current
  // Build with an empty catalog when not ready: counts/hectares/animals are
  // still valid; income just resolves to 0 (rendered as "—" below).
  const engineCatalog = catalog ?? {
    crops: [],
    silageCrops: [],
    animalTypes: [],
    constants: catalogStore.constants ?? {
      defaultYieldBonus: 0,
      strawBonus: 0,
      mineralFeedPrice: 0,
      silagePrice: 0,
      silageWeight: 0,
      strawYieldPerM2: 0,
      grassYieldPerM2: 0,
      yieldBonusScalar: 1,
      incomeDifficultyScalars: { easy: 1, normal: 1, hard: 1 },
      feedPurchasePrices: {},
      milkPriceScalars: { average: 1, max: 1, monthly: [] },
    },
  }
  const ctxOrDefault: FarmContext = ctx ?? {
    difficulty: 'normal',
    defaultYieldBonus: 0,
    sellPriceType: 'baseline',
  }
  return buildFarmSummary(
    fieldStore.fields,
    stableStore.stables,
    engineCatalog,
    ctxOrDefault,
    (id) => catalogStore.cropById(id),
  )
})

const incomeDisplay = computed(() =>
  catalogReady.value ? formatCurrency(summary.value.totalGrossIncome) : '—',
)

const cropColumns: DataTableColumn[] = [
  { key: 'nameEs', label: 'Cultivo' },
  { key: 'fieldCount', label: 'Campos', align: 'right', width: '5rem' },
  { key: 'hectares', label: 'Hectáreas', align: 'right' },
  { key: 'yieldLiters', label: 'Rendimiento (L)', align: 'right' },
  { key: 'grossIncome', label: 'Ingreso bruto', align: 'right' },
]

const cropRows = computed<CropDistributionRow[]>(() => summary.value.cropDistribution)
const hasAnimals = computed(() => summary.value.animalsBySpecies.length > 0)
</script>

<template>
  <div class="farm-summary">
    <section class="farm-summary__kpis">
      <StatCard label="Campos" :value="formatInteger(summary.fieldCount)" />
      <StatCard
        label="Hectáreas totales"
        :value="formatHectares(summary.totalHectares)"
        unit="ha"
        :hint="`${formatHectares(summary.assignedHectares)} ha con cultivo`"
      />
      <StatCard label="Establos" :value="formatInteger(summary.stableCount)" />
      <StatCard label="Animales" :value="formatInteger(summary.totalAnimals)" />
      <StatCard
        label="Ingreso bruto estimado"
        :value="incomeDisplay"
        tone="success"
        :hint="
          catalogReady
            ? 'Cultivos asignados, dificultad de la partida'
            : 'Cargando catálogo…'
        "
      />
    </section>

    <GlassCard title="Distribución de cultivos" flush>
      <DataTable :columns="cropColumns" :rows="cropRows" row-key="slug">
        <template #cell-hectares="{ row }">
          {{ formatHectares(row.hectares) }} ha
        </template>
        <template #cell-yieldLiters="{ row }">
          {{ formatInteger(row.yieldLiters) }}
        </template>
        <template #cell-grossIncome="{ row }">
          {{ catalogReady ? formatCurrency(row.grossIncome) : '—' }}
        </template>
        <template #empty>
          <span>No hay campos con cultivo asignado.</span>
        </template>
      </DataTable>
    </GlassCard>

    <GlassCard v-if="hasAnimals" title="Animales por especie">
      <ul class="farm-summary__species">
        <li
          v-for="row in summary.animalsBySpecies"
          :key="row.species"
          class="farm-summary__species-item"
        >
          <span class="farm-summary__species-name">{{ speciesLabel(row.species) }}</span>
          <span class="farm-summary__species-count">{{ formatInteger(row.count) }}</span>
        </li>
      </ul>
    </GlassCard>
  </div>
</template>

<style scoped lang="scss">
.farm-summary {
  display: flex;
  flex-direction: column;
  gap: $space-lg;

  &__kpis {
    display: grid;
    gap: $space-md;
    grid-template-columns: 1fr;

    @include respond-to('sm') {
      grid-template-columns: repeat(2, 1fr);
    }

    @include respond-to('lg') {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  &__species {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: $space-md;
  }

  &__species-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: $space-sm $space-lg;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    background: var(--glass-bg);
  }

  &__species-name {
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &__species-count {
    color: var(--text-strong);
    font-size: 1.25rem;
    font-weight: 700;
  }
}
</style>
