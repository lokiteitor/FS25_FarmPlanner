<script setup lang="ts">
import { computed } from 'vue'
import { GlassCard } from '~/shared/ui'
import type { ProductionBuildingResult } from '~/shared/lib/engine'

const props = defineProps<{
  projection: ProductionBuildingResult
}>()

function fmt(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString('es')
    : n.toLocaleString('es', { maximumFractionDigits: 2 })
}

const activeChains = computed(() => props.projection.chains.filter((c) => c.isActive))
const inactiveChains = computed(() => props.projection.chains.filter((c) => !c.isActive))
</script>

<template>
  <GlassCard class="bpanel">
    <!-- Header -->
    <div class="bpanel__header">
      <h3 class="bpanel__name">{{ projection.buildingName }}</h3>
      <span class="bpanel__recipe-count">
        {{ projection.activeChainCount }}
        {{ projection.activeChainCount === 1 ? 'receta' : 'recetas' }}
      </span>
    </div>

    <!-- Per-chain cycle split -->
    <div v-if="activeChains.length > 0" class="bpanel__section">
      <p class="bpanel__section-label">Ciclos / mes</p>
      <div class="bpanel__rows">
        <div v-for="chain in activeChains" :key="chain.chainId" class="bpanel__row">
          <span class="bpanel__row-name">{{ chain.name }}</span>
          <span class="bpanel__row-value bpanel__row-value--cycle">
            {{ fmt(chain.effectiveCyclesPerMonth) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Inputs required per month -->
    <div v-if="projection.totalInputsPerMonth.length > 0" class="bpanel__section">
      <p class="bpanel__section-label bpanel__section-label--inputs">
        <span class="bpanel__dot bpanel__dot--inputs" />
        Inputs / mes
      </p>
      <div class="bpanel__rows">
        <div
          v-for="io in projection.totalInputsPerMonth"
          :key="io.slug"
          class="bpanel__row"
        >
          <span class="bpanel__row-name">{{ io.label ?? io.slug }}</span>
          <span class="bpanel__row-value bpanel__row-value--input">
            {{ fmt(io.quantityPerMonth) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Outputs produced per month -->
    <div v-if="projection.totalOutputsPerMonth.length > 0" class="bpanel__section">
      <p class="bpanel__section-label bpanel__section-label--outputs">
        <span class="bpanel__dot bpanel__dot--outputs" />
        Producción / mes
      </p>
      <div class="bpanel__rows">
        <div
          v-for="io in projection.totalOutputsPerMonth"
          :key="io.slug"
          class="bpanel__row"
        >
          <span class="bpanel__row-name">{{ io.label ?? io.slug }}</span>
          <span class="bpanel__row-value bpanel__row-value--output">
            {{ fmt(io.quantityPerMonth) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Inactive chains -->
    <p v-if="inactiveChains.length > 0" class="bpanel__inactive">
      Inactivas: {{ inactiveChains.map((c) => c.name).join(', ') }}
    </p>

    <!-- Empty state -->
    <p v-if="projection.activeChainCount === 0" class="bpanel__empty">
      No hay recetas activas en este edificio.
    </p>
  </GlassCard>
</template>

<style scoped lang="scss">
.bpanel {
  // GlassCard already sets display:flex flex-direction:column gap:$space-md

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-sm;
  }

  &__name {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-strong);
  }

  &__recipe-count {
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

  // ── Section ────────────────────────────────────────────────────────────────

  &__section {
    display: flex;
    flex-direction: column;
    gap: $space-xs;
    padding-top: $space-sm;
    border-top: 1px solid var(--glass-border);
  }

  &__section-label {
    display: flex;
    align-items: center;
    gap: $space-xs;
    margin: 0;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);

    &--inputs { color: rgba(252, 165, 165, 0.8); }
    &--outputs { color: rgba(110, 231, 183, 0.8); }
  }

  &__dot {
    flex-shrink: 0;
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;

    &--inputs  { background: rgb(252, 165, 165); }
    &--outputs { background: rgb(52, 211, 153); }
  }

  // ── Rows ───────────────────────────────────────────────────────────────────

  &__rows {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  &__row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: $space-sm;
  }

  &__row-name {
    flex: 1;
    min-width: 0;
    font-size: 0.875rem;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__row-value {
    flex-shrink: 0;
    font-family: $font-mono;
    font-size: 0.875rem;
    font-weight: 500;

    &--cycle  { color: rgb(167, 243, 208); }
    &--input  { color: rgb(252, 165, 165); }
    &--output { color: rgb(110, 231, 183); }
  }

  // ── Misc ───────────────────────────────────────────────────────────────────

  &__inactive {
    margin: 0;
    padding-top: $space-sm;
    border-top: 1px solid var(--glass-border);
    font-size: 0.75rem;
    color: var(--text-muted);
    opacity: 0.6;
  }

  &__empty {
    margin: 0;
    padding: $space-md 0;
    text-align: center;
    font-size: 0.875rem;
    color: var(--text-muted);
    opacity: 0.5;
  }
}
</style>
