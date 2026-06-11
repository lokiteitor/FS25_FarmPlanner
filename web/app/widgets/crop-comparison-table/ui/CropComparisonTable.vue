<script setup lang="ts">
// widgets/crop-comparison-table — compares every crop of the active catalog for a
// given field area, using the PURE engine (shared/lib/engine.compareCrops, whose
// per-row `incomeByDifficulty` covers easy/normal/hard). Columns: cultivo
// (name_es), rendimiento (L), precio ($/L), ingresos por dificultad and a
// "Sembrar" action that emits the chosen crop slug so the host (pages/fields)
// can assign it to a field.
//
// FSD: a widget composes lower layers via their public APIs. It receives the
// catalog + farm context as props (parametrized, ADR-F04) instead of importing
// stores, keeping it presentational and independently testable. It uses
// shared/ui DataTable and shared/lib/engine + format.
import { computed, ref, watch } from 'vue'
import { AppButton, AppInput, DataTable, GlassCard } from '~/shared/ui'
import type { DataTableColumn } from '~/shared/ui'
import { compareCrops } from '~/shared/lib/engine'
import type { EngineCatalog, FarmContext } from '~/shared/lib/engine'
import { formatMoney, formatNumber } from '~/shared/lib/format'

const props = withDefaults(
  defineProps<{
    catalog: EngineCatalog
    farm: FarmContext
    /** Initial field area to compare crops on (hectares). */
    hectares?: number
  }>(),
  {
    hectares: 1,
  },
)

const emit = defineEmits<{
  /** User picked a crop to sow on a field; payload is the crop SLUG. */
  sow: [slug: string]
}>()

// Local, editable hectares (seeded from the prop) so the user can rescale the
// comparison without the host having to round-trip the value.
const hectaresInput = ref(String(props.hectares))
watch(
  () => props.hectares,
  (h) => {
    hectaresInput.value = String(h)
  },
)

const hectares = computed(() => {
  const n = Number(hectaresInput.value)
  return Number.isFinite(n) && n > 0 ? n : 0
})

interface Row extends Record<string, unknown> {
  slug: string
  nameEs: string
  yieldLiters: number
  pricePerLiter: number
  easy: number
  normal: number
  hard: number
}

const rows = computed<Row[]>(() => {
  if (hectares.value <= 0) return []
  return compareCrops(props.catalog.crops, hectares.value, props.farm, props.catalog)
    .map((r) => ({
      slug: r.slug,
      nameEs: r.nameEs,
      yieldLiters: r.yieldLiters,
      pricePerLiter: r.pricePerLiter,
      easy: r.incomeByDifficulty.easy,
      normal: r.incomeByDifficulty.normal,
      hard: r.incomeByDifficulty.hard,
    }))
    // Most profitable first (at the farm's difficulty == normal column order is
    // arbitrary; we sort by the farm difficulty's income for relevance).
    .sort((a, b) => incomeFor(b) - incomeFor(a))
})

/** Income at the farm's difficulty, for the default sort. */
function incomeFor(row: Row): number {
  return row[props.farm.difficulty]
}

const columns: DataTableColumn[] = [
  { key: 'nameEs', label: 'Cultivo' },
  { key: 'yieldLiters', label: 'Rendimiento (L)', align: 'right' },
  { key: 'pricePerLiter', label: 'Precio ($/L)', align: 'right' },
  { key: 'easy', label: 'Ingreso fácil', align: 'right' },
  { key: 'normal', label: 'Ingreso normal', align: 'right' },
  { key: 'hard', label: 'Ingreso difícil', align: 'right' },
  { key: 'actions', label: '', align: 'right', width: '7rem' },
]

function onSow(slug: string) {
  emit('sow', slug)
}
</script>

<template>
  <GlassCard
    title="Comparativa de cultivos"
    subtitle="Ingresos estimados por dificultad para la superficie indicada"
  >
    <div class="crop-comparison__controls">
      <AppInput
        v-model="hectaresInput"
        label="Hectáreas"
        type="number"
        helper="Superficie usada para la comparativa"
      />
    </div>

    <DataTable :columns="columns" :rows="rows" row-key="slug">
      <template #cell-yieldLiters="{ value }">
        {{ formatNumber(value as number) }}
      </template>
      <template #cell-pricePerLiter="{ value }">
        {{ formatMoney(value as number, 3) }}
      </template>
      <template #cell-easy="{ value }">
        {{ formatMoney(value as number) }}
      </template>
      <template #cell-normal="{ value }">
        {{ formatMoney(value as number) }}
      </template>
      <template #cell-hard="{ value }">
        {{ formatMoney(value as number) }}
      </template>
      <template #cell-actions="{ row }">
        <AppButton size="sm" variant="ghost" @click="onSow((row as Row).slug)">
          Sembrar
        </AppButton>
      </template>
      <template #empty>
        <span>Introduce una superficie válida para comparar cultivos.</span>
      </template>
    </DataTable>
  </GlassCard>
</template>

<style scoped lang="scss">
.crop-comparison {
  &__controls {
    max-width: 12rem;
  }
}
</style>
