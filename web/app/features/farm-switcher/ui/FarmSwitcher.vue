<script setup lang="ts">
// features/farm-switcher/ui/FarmSwitcher — the active-farm picker mounted at the
// top of the sidebar. Shows the active partida, opens a dropdown to switch
// between farms, and hosts the create/edit/delete modal (FarmManageModal).
//
// Selecting a farm goes through the farm store (setActiveFarm, which also
// persists the pin to /me/settings) and then reloads the catalog store for the
// newly active game version. A `changed` event lets the host (dashboard) reload
// per-farm data (fields/stables). All data flows through stores (FSD §8.1).
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { AppButton } from '~/shared/ui'
import { useFarmStore } from '~/entities/farm'
import type { Farm } from '~/entities/farm'
import { useCatalogStore } from '~/entities/catalog'
import { difficultyLabel } from '../lib/options'
import FarmManageModal from './FarmManageModal.vue'

const emit = defineEmits<{
  /** The active farm changed (id is the new active farm, or null). */
  changed: [farmId: string | null]
}>()

const farmStore = useFarmStore()
const catalogStore = useCatalogStore()

const menuOpen = ref(false)
const modalOpen = ref(false)
/** Farm being edited in the modal; null → create mode. */
const editing = ref<Farm | null>(null)
const rootRef = ref<HTMLElement | null>(null)

const farms = computed(() => farmStore.farms)
const activeFarm = computed(() => farmStore.activeFarm)
const switching = computed(() => farmStore.saving)

/** Reload the catalog for a game version, then notify the host of the change. */
async function activateVersionAndNotify(farmId: string | null, gameVersionId: string | null) {
  if (gameVersionId) {
    await catalogStore.load(gameVersionId)
  }
  emit('changed', farmId)
}

async function onSelect(farm: Farm) {
  menuOpen.value = false
  if (farm.id === farmStore.activeFarmId) return
  await farmStore.setActiveFarm(farm.id)
  await activateVersionAndNotify(farm.id, farm.gameVersionId)
}

function openCreate() {
  menuOpen.value = false
  editing.value = null
  modalOpen.value = true
}

function openEdit(farm: Farm) {
  menuOpen.value = false
  editing.value = farm
  modalOpen.value = true
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

/** A new farm was created: activate it (catalog + pin) and reload the host. */
async function onSaved(farm: Farm) {
  await farmStore.setActiveFarm(farm.id)
  await activateVersionAndNotify(farm.id, farm.gameVersionId)
}

/** A farm was edited: its game version may have changed → reload catalog. */
async function onUpdated() {
  const active = farmStore.activeFarm
  if (active) {
    await activateVersionAndNotify(active.id, active.gameVersionId)
  }
}

/** A farm was deleted: the store cleared the pin if it was active. */
async function onDeleted() {
  const active = farmStore.activeFarm
  await activateVersionAndNotify(active?.id ?? null, active?.gameVersionId ?? null)
}

/** Close the dropdown when clicking outside it. */
function onDocumentClick(event: MouseEvent) {
  if (!menuOpen.value) return
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    menuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))

/** Expose for the host to open the create modal (no-farm empty state). */
defineExpose({ openCreate })
</script>

<template>
  <div ref="rootRef" class="farm-switcher">
    <button
      type="button"
      class="farm-switcher__trigger"
      :aria-expanded="menuOpen"
      aria-haspopup="listbox"
      :disabled="switching"
      @click="toggleMenu"
    >
      <span class="farm-switcher__trigger-text">
        <span class="farm-switcher__label">Partida</span>
        <span class="farm-switcher__name">
          {{ activeFarm?.name ?? 'Selecciona una partida' }}
        </span>
        <span v-if="activeFarm" class="farm-switcher__meta">
          {{ activeFarm.mapName || 'Sin mapa' }} · {{ difficultyLabel(activeFarm.difficulty) }}
        </span>
      </span>
      <span class="farm-switcher__caret" aria-hidden="true" />
    </button>

    <div v-if="menuOpen" class="farm-switcher__menu" role="listbox">
      <ul v-if="farms.length" class="farm-switcher__list">
        <li v-for="farm in farms" :key="farm.id" class="farm-switcher__item">
          <button
            type="button"
            class="farm-switcher__option"
            :class="{ 'farm-switcher__option--active': farm.id === farmStore.activeFarmId }"
            role="option"
            :aria-selected="farm.id === farmStore.activeFarmId"
            @click="onSelect(farm)"
          >
            <span class="farm-switcher__option-name">{{ farm.name }}</span>
            <span class="farm-switcher__option-meta">
              {{ farm.mapName || 'Sin mapa' }} · {{ difficultyLabel(farm.difficulty) }}
            </span>
          </button>
          <button
            type="button"
            class="farm-switcher__edit"
            aria-label="Editar partida"
            @click="openEdit(farm)"
          >
            ✎
          </button>
        </li>
      </ul>
      <p v-else class="farm-switcher__empty">Aún no tienes partidas.</p>

      <AppButton variant="ghost" size="sm" block @click="openCreate">
        + Nueva partida
      </AppButton>
    </div>

    <FarmManageModal
      :open="modalOpen"
      :farm="editing"
      @close="modalOpen = false"
      @saved="onSaved"
      @updated="onUpdated"
      @deleted="onDeleted"
    />
  </div>
</template>

<style scoped lang="scss">
.farm-switcher {
  position: relative;

  &__trigger {
    @include focus-ring;

    display: flex;
    align-items: center;
    gap: $space-sm;
    width: 100%;
    padding: $space-sm $space-md;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    background: var(--glass-bg);
    color: var(--text);
    cursor: pointer;
    text-align: left;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast);

    &:hover:not(:disabled) {
      background: var(--glass-bg-strong);
      border-color: var(--text-muted);
    }

    &:disabled {
      opacity: 0.6;
      cursor: progress;
    }
  }

  &__trigger-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1 1 auto;
    min-width: 0;
  }

  &__label {
    color: var(--text-muted);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  &__name {
    color: var(--text-strong);
    font-weight: 600;
    font-size: 0.9375rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    color: var(--text-muted);
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__caret {
    flex-shrink: 0;
    width: 0.5rem;
    height: 0.5rem;
    border-right: 2px solid var(--text-muted);
    border-bottom: 2px solid var(--text-muted);
    transform: translateY(-2px) rotate(45deg);
  }

  &__menu {
    position: absolute;
    top: calc(100% + #{$space-xs});
    left: 0;
    right: 0;
    z-index: var(--z-dropdown, 50);
    display: flex;
    flex-direction: column;
    gap: $space-sm;
    padding: $space-sm;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    background: var(--glass-bg-strong);
    backdrop-filter: blur(var(--blur-glass));
    -webkit-backdrop-filter: blur(var(--blur-glass));
    box-shadow: var(--shadow-lg, 0 12px 32px rgba(0, 0, 0, 0.35));
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 16rem;
    overflow-y: auto;
  }

  &__item {
    display: flex;
    align-items: stretch;
    gap: $space-xs;
  }

  &__option {
    @include focus-ring;

    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: $space-sm $space-md;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text);
    cursor: pointer;
    text-align: left;
    min-width: 0;

    &:hover {
      background: var(--glass-bg);
    }

    &--active {
      background: var(--glass-bg);
      box-shadow: inset 3px 0 0 var(--primary);
    }
  }

  &__option-name {
    color: var(--text-strong);
    font-weight: 600;
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__option-meta {
    color: var(--text-muted);
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__edit {
    @include focus-ring;

    flex-shrink: 0;
    width: 2rem;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.9rem;

    &:hover {
      background: var(--glass-bg);
      color: var(--text-strong);
    }
  }

  &__empty {
    margin: 0;
    padding: $space-sm $space-md;
    color: var(--text-muted);
    font-size: 0.8125rem;
  }
}
</style>
