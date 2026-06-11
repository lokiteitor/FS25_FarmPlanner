<script setup lang="ts">
// widgets/animal-calculator-panels/ui/AnimalFieldworkPanel — feed & fieldwork
// breakdown: per-requirement liters/year, hectares of field needed and any
// monetary cost (bought feed / mineral feed). Read from the engine's
// AnimalProjectionResult.fieldwork. PURE presentation.
import { computed } from 'vue'
import { DataTable, GlassCard, StatCard } from '~/shared/ui'
import type { DataTableColumn } from '~/shared/ui'
import type { AnimalProjectionResult } from '~/shared/lib/engine'
import type { Catalog } from '~/entities/catalog'
import { rateLabelEs } from '../lib/speciesMeta'
import { fmtInt, fmtDec, fmtMoney } from '../lib/format'

const props = defineProps<{
  projection: AnimalProjectionResult
  catalog: Catalog
}>()

interface Row {
  key: string
  concept: string
  litersPerYear: number
  hectaresNeeded: number | null
  costPerYear: number | null
  [k: string]: unknown
}

const columns: DataTableColumn[] = [
  { key: 'concept', label: 'Requisito' },
  { key: 'litersPerYear', label: 'L / año', align: 'right' },
  { key: 'hectaresNeeded', label: 'Ha necesarias', align: 'right' },
  { key: 'costPerYear', label: 'Coste / año', align: 'right' },
]

/** Build a Spanish concept label from the requirement key (e.g. "silage:corn"). */
function conceptLabel(key: string, slug?: string): string {
  if (key.startsWith('silage:')) {
    const cropSlug = key.slice('silage:'.length)
    const crop = props.catalog.crops.find((c) => c.slug === cropSlug)
    return `Ensilaje (${crop?.nameEs ?? cropSlug})`
  }
  if (key === 'mineralFeed') return 'Pienso mineral'
  if (key === 'tmr-straw') return 'Paja (TMR)'
  if (key.startsWith('feed:')) {
    const cropSlug = slug ?? key.slice('feed:'.length)
    const crop = props.catalog.crops.find((c) => c.slug === cropSlug)
    return crop ? `Pienso (${crop.nameEs})` : 'Pienso'
  }
  if (key.startsWith('grown:')) {
    const cropSlug = slug ?? key.slice('grown:'.length)
    const crop = props.catalog.crops.find((c) => c.slug === cropSlug)
    return `Cultivo propio (${crop?.nameEs ?? cropSlug})`
  }
  return rateLabelEs(key)
}

const rows = computed<Row[]>(() =>
  props.projection.fieldwork.requirements.map((r) => ({
    key: r.key,
    concept: conceptLabel(r.key, r.slug),
    litersPerYear: r.litersPerYear,
    hectaresNeeded: r.hectaresNeeded ?? null,
    costPerYear: r.costPerYear ?? null,
  })),
)

const totalHa = computed(() => props.projection.fieldwork.totalHectaresNeeded)
</script>

<template>
  <GlassCard title="Alimentación y campo" subtitle="Requisitos anuales de la cabaña">
    <div class="animal-fieldwork">
      <div class="animal-fieldwork__stats">
        <StatCard
          label="Superficie total necesaria"
          :value="fmtDec(totalHa)"
          unit="ha"
        />
        <StatCard
          label="Coste de pienso / año"
          :value="fmtMoney(projection.economics.feedCost)"
          tone="warning"
        />
      </div>

      <DataTable :columns="columns" :rows="rows" row-key="key" caption="Requisitos">
        <template #cell-litersPerYear="{ value }">{{ fmtInt(value as number) }}</template>
        <template #cell-hectaresNeeded="{ value }">
          {{ value === null ? '—' : fmtDec(value as number) }}
        </template>
        <template #cell-costPerYear="{ value }">
          {{ value === null ? '—' : fmtMoney(value as number) }}
        </template>
        <template #empty>Sin requisitos de alimentación</template>
      </DataTable>
    </div>
  </GlassCard>
</template>

<style scoped lang="scss">
.animal-fieldwork {
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
  }
}
</style>
