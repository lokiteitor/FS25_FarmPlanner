<script setup lang="ts">
// widgets/stables-summary/ui/StablesSummary — consolidated overview of a farm's
// stables shown on the stables page: grand-total KPIs (total animals, total
// capacity, overall utilization) plus a per-species breakdown card. Pure
// presentation: the page passes the loaded stables in; aggregation is done by
// lib/summarize. Species labels come from features/stable-manage (catalog name_es).
import { computed } from 'vue'
import { GlassCard, StatCard } from '~/shared/ui'
import type { StatCardTone } from '~/shared/ui'
import type { Stable } from '~/entities/stable'
import { speciesLabel } from '~/features/stable-manage'
import { summarizeBySpecies, totalsOf } from '../lib/summarize'

const props = defineProps<{
  stables: Stable[]
}>()

const totals = computed(() => totalsOf(props.stables))

const bySpecies = computed(() =>
  summarizeBySpecies(props.stables).sort((a, b) =>
    speciesLabel(a.species).localeCompare(speciesLabel(b.species), 'es'),
  ),
)

/** Format a 0..1 ratio as an integer percentage. */
function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

/** Tone the utilization KPI by how full the stables are. */
function toneFor(ratio: number): StatCardTone {
  if (ratio >= 1) return 'danger'
  if (ratio >= 0.85) return 'warning'
  return 'success'
}
</script>

<template>
  <div class="stables-summary">
    <div class="stables-summary__kpis">
      <StatCard label="Establos" :value="totals.stableCount" />
      <StatCard label="Animales" :value="totals.animals" />
      <StatCard
        label="Capacidad"
        :value="totals.capacity"
        :hint="`${totals.animals} ocupados`"
      />
      <StatCard
        label="Ocupación"
        :value="pct(totals.utilization)"
        :tone="toneFor(totals.utilization)"
      />
    </div>

    <GlassCard
      v-if="bySpecies.length"
      title="Resumen por especie"
      subtitle="Animales y ocupación consolidados por tipo"
    >
      <ul class="stables-summary__list">
        <li
          v-for="row in bySpecies"
          :key="row.species"
          class="stables-summary__row"
        >
          <div class="stables-summary__row-head">
            <span class="stables-summary__species">{{ speciesLabel(row.species) }}</span>
            <span class="stables-summary__meta">
              {{ row.stableCount }} {{ row.stableCount === 1 ? 'establo' : 'establos' }}
            </span>
          </div>

          <div class="stables-summary__bar" :aria-label="`Ocupación ${pct(row.utilization)}`">
            <span
              class="stables-summary__bar-fill"
              :class="`stables-summary__bar-fill--${toneFor(row.utilization)}`"
              :style="{ width: `${Math.min(row.utilization, 1) * 100}%` }"
            />
          </div>

          <div class="stables-summary__row-foot">
            <span>{{ row.animals }} / {{ row.capacity }} animales</span>
            <span class="stables-summary__pct">{{ pct(row.utilization) }}</span>
          </div>
        </li>
      </ul>
    </GlassCard>
  </div>
</template>

<style scoped lang="scss">
.stables-summary {
  display: flex;
  flex-direction: column;
  gap: $space-lg;

  &__kpis {
    display: grid;
    gap: $space-md;
    grid-template-columns: repeat(2, 1fr);

    @include respond-to('md') {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: $space-md;
  }

  &__row {
    display: flex;
    flex-direction: column;
    gap: $space-xs;
  }

  &__row-head,
  &__row-foot {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: $space-sm;
  }

  &__species {
    color: var(--text-strong);
    font-weight: 600;
  }

  &__meta {
    color: var(--text-muted);
    font-size: 0.8125rem;
  }

  &__row-foot {
    color: var(--text-muted);
    font-size: 0.8125rem;
  }

  &__pct {
    color: var(--text);
    font-weight: 600;
  }

  &__bar {
    height: 0.5rem;
    border-radius: var(--radius-pill);
    background: var(--glass-bg);
    overflow: hidden;
  }

  &__bar-fill {
    display: block;
    height: 100%;
    border-radius: var(--radius-pill);
    background: var(--primary);
    transition: width var(--transition-base);

    &--warning {
      background: var(--warning);
    }

    &--danger {
      background: var(--danger);
    }
  }
}
</style>
