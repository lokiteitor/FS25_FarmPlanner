<script setup lang="ts">
// Themed button. Variants map to the glass theme; `loading` shows a spinner and
// blocks clicks (also disables). Emits a native-typed `click` event.
export type AppButtonVariant = 'primary' | 'ghost' | 'danger'
export type AppButtonSize = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: AppButtonVariant
    size?: AppButtonSize
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    /** Stretches the button to fill its container. */
    block?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    loading: false,
    disabled: false,
    type: 'button',
    block: false,
  },
)

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

function onClick(event: MouseEvent) {
  if (props.disabled || props.loading) return
  emit('click', event)
}
</script>

<template>
  <button
    :type="type"
    class="app-btn"
    :class="[
      `app-btn--${variant}`,
      `app-btn--${size}`,
      { 'app-btn--block': block, 'app-btn--loading': loading },
    ]"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    @click="onClick"
  >
    <span v-if="loading" class="app-btn__spinner" aria-hidden="true" />
    <span class="app-btn__label"><slot /></span>
  </button>
</template>

<style scoped lang="scss">
.app-btn {
  @include focus-ring;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $space-sm;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast),
    opacity var(--transition-fast);

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  // Sizes
  &--sm {
    padding: $space-xs $space-md;
    font-size: 0.8125rem;
  }

  &--md {
    padding: $space-sm $space-lg;
    font-size: 0.9375rem;
  }

  &--lg {
    padding: $space-md $space-xl;
    font-size: 1.0625rem;
  }

  &--block {
    width: 100%;
  }

  // Variants
  &--primary {
    background: var(--primary);
    color: #06210f;

    &:hover:not(:disabled) {
      background: var(--primary-dark);
    }
  }

  &--ghost {
    background: var(--glass-bg);
    border-color: var(--glass-border);
    color: var(--text);
    backdrop-filter: blur(var(--blur-glass));
    -webkit-backdrop-filter: blur(var(--blur-glass));

    &:hover:not(:disabled) {
      background: var(--glass-bg-strong);
    }
  }

  &--danger {
    background: var(--danger);
    color: #2a070b;

    &:hover:not(:disabled) {
      filter: brightness(1.08);
    }
  }

  &--loading {
    cursor: progress;
  }

  &__spinner {
    width: 1em;
    height: 1em;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: var(--radius-pill);
    animation: app-btn-spin 0.6s linear infinite;
  }
}

@keyframes app-btn-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-btn__spinner {
    animation-duration: 1.4s;
  }
}
</style>
