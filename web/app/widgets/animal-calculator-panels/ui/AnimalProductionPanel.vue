<script setup lang="ts">
// widgets/animal-calculator-panels/ui/AnimalProductionPanel — monthly + annual
// production / consumption and the herd economics, all read from the engine's
// AnimalProjectionResult. PURE presentation: the projection is computed by the
// parent (orchestrator) and passed in.
import { computed } from 'vue'
import { DataTable, GlassCard, StatCard } from '~/shared/ui'
import type { DataTableColumn } from '~/shared/ui'
import type { AnimalProjectionResult } from '~/shared/lib/engine'
import { rateLabelEs } from '../lib/speciesMeta'
import { fmtInt, fmtMoney, fmtDec } from '../lib/format'

const props = defineProps<{
  projection: AnimalProjectionResult
}>()

interface Row {
  key: string
  label: string
  perMonth: number
  perYear: number
  [k: string]: unknown
}

const columns: DataTableColumn[] = [
  { key: 'label', label: 'Concepto' },
  { key: 'perMonth', label: 'L / mes', align: 'right' },
  { key: 'perYear', label: 'L / año', align: 'right' },
]

const productionRows = computed<Row[]>(() =>
  Object.entries(props.projection.production.byKey).map(([key, v]) => ({
    key,
    label: rateLabelEs(key),
    perMonth: v.perMonth,
    perYear: v.perYear,
  })),
)

const consumptionRows = computed<Row[]>(() =>
  Object.entries(props.projection.consumption.byKey).map(([key, v]) => ({
    key,
    label: rateLabelEs(key),
    perMonth: v.perMonth,
    perYear: v.perYear,
  })),
)

const eco = computed(() => props.projection.economics)
</script>

<template>
  <GlassCard title="Producción" subtitle="Mensual y anual de la cabaña">
    <div class="animal-prod">
      <div class="animal-prod__stats">
        <StatCard
          label="Ingreso por producto / año"
          :value="fmtMoney(eco.productRevenue)"
        />
        <StatCard
          label="Ingreso por venta / año"
          :value="fmtMoney(eco.salesRevenue)"
        />
        <StatCard
          label="Coste de pienso / año"
          :value="fmtMoney(eco.feedCost)"
          tone="warning"
        />
        <StatCard
          label="Neto / año"
          :value="fmtMoney(eco.net)"
          :tone="eco.net >= 0 ? 'success' : 'danger'"
        />
      </div>

      <div class="animal-prod__factors">
        <span>Factor de producción: {{ fmtDec(projection.productionFactor) }}</span>
        <span>Factor de alimentación: {{ fmtDec(projection.feedProductivityFactor) }}</span>
        <span>Factor de paja: {{ fmtDec(projection.strawBonusFactor) }}</span>
        <span>Escalar de dificultad: {{ fmtDec(projection.difficultyScalar) }}</span>
      </div>

      <h3 class="animal-prod__subtitle">Producción</h3>
      <DataTable :columns="columns" :rows="productionRows" row-key="key" caption="Producción">
        <template #cell-perMonth="{ value }">{{ fmtInt(value as number) }}</template>
        <template #cell-perYear="{ value }">{{ fmtInt(value as number) }}</template>
        <template #empty>Sin producción</template>
      </DataTable>

      <h3 class="animal-prod__subtitle">Consumo</h3>
      <DataTable :columns="columns" :rows="consumptionRows" row-key="key" caption="Consumo">
        <template #cell-perMonth="{ value }">{{ fmtInt(value as number) }}</template>
        <template #cell-perYear="{ value }">{{ fmtInt(value as number) }}</template>
        <template #empty>Sin consumo</template>
      </DataTable>
    </div>
  </GlassCard>
</template>

<style scoped lang="scss">
.animal-prod {
  display: flex;
  flex-direction: column;
  gap: $space-md;

  &__stats {
    display: grid;
    gap: $space-md;
    grid-template-columns: 1fr;

    @include respond-to('sm') {
      grid-template-columns: repeat(2, 1fr);
    }

    @include respond-to('lg') {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  &__factors {
    display: flex;
    flex-wrap: wrap;
    gap: $space-md;
    color: var(--text-muted);
    font-size: 0.8125rem;
  }

  &__subtitle {
    margin: 0;
    color: var(--text-strong);
    font-size: 1rem;
  }
}
</style>
