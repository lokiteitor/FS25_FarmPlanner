<script setup lang="ts">
// KPI tile: a label, a prominent value with an optional unit, and an optional
// hint line. `tone` tints the value to convey status.
export type StatCardTone = 'default' | 'success' | 'warning' | 'danger'

withDefaults(
  defineProps<{
    label: string
    value: string | number
    unit?: string
    hint?: string
    tone?: StatCardTone
  }>(),
  {
    unit: undefined,
    hint: undefined,
    tone: 'default',
  },
)
</script>

<template>
  <div class="stat-card" :class="`stat-card--${tone}`">
    <span class="stat-card__label">{{ label }}</span>
    <p class="stat-card__value">
      <span class="stat-card__number">{{ value }}</span>
      <span v-if="unit" class="stat-card__unit">{{ unit }}</span>
    </p>
    <span v-if="hint" class="stat-card__hint">{{ hint }}</span>
  </div>
</template>

<style scoped lang="scss">
.stat-card {
  @include glass-card;

  display: flex;
  flex-direction: column;
  gap: $space-xs;
  padding: $space-md $space-lg;

  &__label {
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &__value {
    display: flex;
    align-items: baseline;
    gap: $space-xs;
    margin: 0;
  }

  &__number {
    color: var(--text-strong);
    font-size: 1.75rem;
    font-weight: 700;
    line-height: 1.1;
  }

  &__unit {
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 600;
  }

  &__hint {
    color: var(--text-muted);
    font-size: 0.8125rem;
  }

  &--success &__number {
    color: var(--success);
  }

  &--warning &__number {
    color: var(--warning);
  }

  &--danger &__number {
    color: var(--danger);
  }
}
</style>
