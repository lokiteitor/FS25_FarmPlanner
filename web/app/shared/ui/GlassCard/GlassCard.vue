<script setup lang="ts">
// Glassmorphism surface. Optional header (title/subtitle) plus default slot for
// body content. A `header` slot overrides the title/subtitle props entirely; a
// `footer` slot adds an actions row below the body.
withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    /** Removes the inner padding (e.g. when wrapping a DataTable edge-to-edge). */
    flush?: boolean
  }>(),
  {
    title: undefined,
    subtitle: undefined,
    flush: false,
  },
)

defineSlots<{
  default(): unknown
  header(): unknown
  footer(): unknown
}>()
</script>

<template>
  <section class="glass-card-ui" :class="{ 'glass-card-ui--flush': flush }">
    <header v-if="$slots.header || title || subtitle" class="glass-card-ui__header">
      <slot name="header">
        <h2 v-if="title" class="glass-card-ui__title">{{ title }}</h2>
        <p v-if="subtitle" class="glass-card-ui__subtitle">{{ subtitle }}</p>
      </slot>
    </header>

    <div class="glass-card-ui__body">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="glass-card-ui__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped lang="scss">
.glass-card-ui {
  @include glass-card;

  display: flex;
  flex-direction: column;
  gap: $space-md;

  &--flush {
    padding: 0;
    overflow: hidden;
  }

  &--flush &__header {
    padding: $space-lg $space-lg 0;
  }

  &--flush &__footer {
    padding: 0 $space-lg $space-lg;
  }

  &__header {
    display: flex;
    flex-direction: column;
    gap: $space-xs;
  }

  &__title {
    margin: 0;
    font-size: 1.125rem;
    color: var(--text-strong);
  }

  &__subtitle {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  &__body {
    display: block;
  }

  &__footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-sm;
  }
}
</style>
