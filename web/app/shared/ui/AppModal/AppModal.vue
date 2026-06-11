<script setup lang="ts">
// Accessible modal dialog teleported to <body>. Controlled via the `open` prop;
// emits `close` on backdrop click, Escape, or the close button. Locks body
// scroll and moves focus into the dialog while open. Provides `header`, default
// (body) and `footer` slots.
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    /** Disable closing on backdrop click / Escape (e.g. while submitting). */
    persistent?: boolean
  }>(),
  {
    title: undefined,
    persistent: false,
  },
)

const emit = defineEmits<{
  close: []
}>()

const dialogRef = ref<HTMLElement | null>(null)
const titleId = useId()

function requestClose() {
  if (props.persistent) return
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') requestClose()
}

watch(
  () => props.open,
  (isOpen) => {
    if (typeof document === 'undefined') return
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', onKeydown)
      nextTick(() => dialogRef.value?.focus())
    } else {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = ''
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="app-modal">
      <div v-if="open" class="app-modal" @click.self="requestClose">
        <div
          ref="dialogRef"
          class="app-modal__dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? titleId : undefined"
          tabindex="-1"
        >
          <header v-if="$slots.header || title" class="app-modal__header">
            <slot name="header">
              <h2 :id="titleId" class="app-modal__title">{{ title }}</h2>
            </slot>
            <button
              type="button"
              class="app-modal__close"
              aria-label="Close dialog"
              @click="requestClose"
            >
              &times;
            </button>
          </header>

          <div class="app-modal__body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="app-modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.app-modal {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $space-lg;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);

  &__dialog {
    @include glass-card;
    @include focus-ring;

    display: flex;
    flex-direction: column;
    gap: $space-md;
    width: 100%;
    max-width: var(--container-sm);
    max-height: calc(100dvh - #{$space-xl});
    background: var(--glass-bg-strong);
    overflow-y: auto;
  }

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: $space-md;
  }

  &__title {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text-strong);
  }

  &__close {
    @include focus-ring;

    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast);

    &:hover {
      color: var(--text-strong);
      background: var(--glass-bg);
    }
  }

  &__body {
    display: block;
  }

  &__footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: $space-sm;
  }
}

// Enter/leave transition (fade + lift).
.app-modal-enter-active,
.app-modal-leave-active {
  transition: opacity var(--transition-base);
}

.app-modal-enter-active .app-modal__dialog,
.app-modal-leave-active .app-modal__dialog {
  transition: transform var(--transition-base);
}

.app-modal-enter-from,
.app-modal-leave-to {
  opacity: 0;
}

.app-modal-enter-from .app-modal__dialog,
.app-modal-leave-to .app-modal__dialog {
  transform: translateY(12px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .app-modal-enter-active,
  .app-modal-leave-active,
  .app-modal-enter-active .app-modal__dialog,
  .app-modal-leave-active .app-modal__dialog {
    transition: none;
  }
}
</style>
