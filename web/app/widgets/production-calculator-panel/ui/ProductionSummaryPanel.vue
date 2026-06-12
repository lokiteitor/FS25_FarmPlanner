<script setup lang="ts">
import { GlassCard } from '~/shared/ui'
import type { FarmProductionSummary } from '../model/useProductionFarmSummary'

defineProps<{
  summary: FarmProductionSummary
}>()

function fmt(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString('es')
    : n.toLocaleString('es', { maximumFractionDigits: 2 })
}

function fmtNet(n: number): string {
  const abs = fmt(Math.abs(n))
  return n >= 0 ? `+${abs}` : `−${abs}`
}
</script>

<template>
  <GlassCard class="summary-panel">
    <div class="summary-panel__header">
      <h2 class="summary-panel__title">Resumen global de producción</h2>
      <span class="summary-panel__meta">
        {{ summary.totalActiveChains }}
        {{ summary.totalActiveChains === 1 ? 'cadena activa' : 'cadenas activas' }}
      </span>
    </div>

    <div v-if="summary.items.length === 0" class="summary-panel__empty">
      No hay cadenas activas con datos calculables.
    </div>

    <div v-else class="summary-panel__table-wrap">
      <table class="summary-panel__table">
        <thead>
          <tr>
            <th class="summary-panel__th summary-panel__th--item">Ingrediente / Producto</th>
            <th class="summary-panel__th summary-panel__th--num summary-panel__th--inputs">
              <span class="summary-panel__dot summary-panel__dot--inputs" />
              Requerido / mes
            </th>
            <th class="summary-panel__th summary-panel__th--num summary-panel__th--outputs">
              <span class="summary-panel__dot summary-panel__dot--outputs" />
              Producido / mes
            </th>
            <th class="summary-panel__th summary-panel__th--num summary-panel__th--net">
              Balance / mes
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in summary.items"
            :key="item.slug"
            class="summary-panel__row"
          >
            <td class="summary-panel__td summary-panel__td--item">{{ item.label }}</td>
            <td class="summary-panel__td summary-panel__td--num">
              <span v-if="item.inputsPerMonth > 0" class="summary-panel__val summary-panel__val--inputs">
                {{ fmt(item.inputsPerMonth) }}
              </span>
              <span v-else class="summary-panel__val summary-panel__val--zero">—</span>
            </td>
            <td class="summary-panel__td summary-panel__td--num">
              <span v-if="item.outputsPerMonth > 0" class="summary-panel__val summary-panel__val--outputs">
                {{ fmt(item.outputsPerMonth) }}
              </span>
              <span v-else class="summary-panel__val summary-panel__val--zero">—</span>
            </td>
            <td class="summary-panel__td summary-panel__td--num">
              <span
                class="summary-panel__val summary-panel__net-pill"
                :class="{
                  'summary-panel__net-pill--surplus':  item.netPerMonth > 0,
                  'summary-panel__net-pill--deficit':  item.netPerMonth < 0,
                  'summary-panel__net-pill--balanced': item.netPerMonth === 0,
                }"
              >
                {{ fmtNet(item.netPerMonth) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </GlassCard>
</template>

<style scoped lang="scss">
.summary-panel {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-sm;
  }

  &__title {
    margin: 0;
    font-size: 1.125rem;
    color: var(--text-strong);
  }

  &__meta {
    flex-shrink: 0;
    padding: 0.15rem $space-sm;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-pill);
    background: var(--glass-bg);
    color: var(--text-muted);
    font-size: 0.7rem;
    font-weight: 500;
    white-space: nowrap;
  }

  &__empty {
    color: var(--text-muted);
    font-size: 0.875rem;
    text-align: center;
    padding: $space-md 0;
  }

  // ── Table ────────────────────────────────────────────────────────────────

  &__table-wrap {
    overflow-x: auto;
    margin: 0 calc(-1 * $space-md);  // bleed to card edges
    padding: 0 $space-md;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  &__th {
    padding: $space-xs $space-sm;
    border-bottom: 1px solid var(--glass-border);
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    white-space: nowrap;

    &--item { text-align: left; }
    &--num  { text-align: right; }

    &--inputs  { color: rgba(252, 165, 165, 0.8); }
    &--outputs { color: rgba(110, 231, 183, 0.8); }
    &--net     { color: var(--text-muted); }
  }

  &__dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    vertical-align: middle;
    margin-right: $space-xs;

    &--inputs  { background: rgb(252, 165, 165); }
    &--outputs { background: rgb(52, 211, 153); }
  }

  &__row {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background var(--transition-fast);

    &:last-child { border-bottom: none; }
    &:hover { background: var(--glass-bg); }
  }

  &__td {
    padding: $space-xs $space-sm;
    vertical-align: middle;

    &--item { color: var(--text); }
    &--num  { text-align: right; }
  }

  &__val {
    font-family: $font-mono;
    font-size: 0.875rem;

    &--inputs { color: rgb(252, 165, 165); }
    &--outputs { color: rgb(110, 231, 183); }
    &--zero { color: var(--text-muted); opacity: 0.4; }
  }

  &__net-pill {
    display: inline-block;
    padding: 0.1em 0.45em;
    border-radius: var(--radius-sm);
    font-family: $font-mono;
    font-size: 0.8rem;
    font-weight: 600;

    &--surplus {
      background: rgba(52, 211, 153, 0.12);
      color: rgb(110, 231, 183);
    }

    &--deficit {
      background: rgba(252, 165, 165, 0.12);
      color: rgb(252, 165, 165);
    }

    &--balanced {
      background: var(--glass-bg);
      color: var(--text-muted);
    }
  }
}
</style>
