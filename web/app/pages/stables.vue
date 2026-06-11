<script setup lang="ts">
// pages/stables — manage the active farm's stables ("establos"). Shows the
// consolidated per-species summary (widgets/stables-summary), a table of every
// stable, and the create/edit dialog (features/stable-manage). Uses the default
// layout (sidebar) and the global auth guard.
//
// Data flow (FSD): the active farm id comes from entities/farm; we load via the
// stable store and pass its `stables` to the widget/table. All mutations go
// through the StableFormModal -> stable store. No $fetch here.
import { computed, onMounted, ref, watch } from 'vue'
import { AppButton, DataTable, GlassCard } from '~/shared/ui'
import type { DataTableColumn } from '~/shared/ui'
import { useFarmStore } from '~/entities/farm'
import { useStableStore } from '~/entities/stable'
import type { Stable } from '~/entities/stable'
import { StableFormModal, speciesLabel } from '~/features/stable-manage'
import { StablesSummary } from '~/widgets/stables-summary'

const farmStore = useFarmStore()
const stableStore = useStableStore()

const activeFarmId = computed(() => farmStore.activeFarmId)
const stables = computed(() => stableStore.stables)
const loading = computed(() => stableStore.loading)
const loadError = computed(() => stableStore.error)

// Modal state.
const modalOpen = ref(false)
const editingStable = ref<Stable | null>(null)

// Inline delete state (id being removed, for per-row spinner/disable).
const removingId = ref<string | null>(null)
const removeError = ref('')

const columns: DataTableColumn[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'species', label: 'Especie' },
  { key: 'currentCount', label: 'Animales', align: 'right', width: '7rem' },
  { key: 'maxCapacity', label: 'Capacidad', align: 'right', width: '7rem' },
  { key: 'utilization', label: 'Ocupación', align: 'right', width: '8rem' },
  { key: 'actions', label: '', align: 'right', width: '12rem' },
]

/** Per-row utilization label (currentCount / maxCapacity as %). */
function rowPct(stable: Stable): string {
  if (stable.maxCapacity <= 0) return '—'
  return `${Math.round((stable.currentCount / stable.maxCapacity) * 100)}%`
}

/** Load the active farm's stables (whenever the active farm changes). */
async function reload() {
  const farmId = activeFarmId.value
  if (!farmId) return
  if (stableStore.farmId === farmId && !loadError.value) return
  await stableStore.load(farmId).catch(() => {
    // Error surfaced via store.error; swallow to keep the page mounted.
  })
}

onMounted(reload)
watch(activeFarmId, reload)

function openCreate() {
  editingStable.value = null
  modalOpen.value = true
}

function openEdit(stable: Stable) {
  editingStable.value = stable
  modalOpen.value = true
}

function onSaved() {
  // The store already inserted/patched the row; nothing else to do.
  modalOpen.value = false
}

async function onDelete(stable: Stable) {
  if (!activeFarmId.value) return
  const ok =
    typeof window === 'undefined' ||
    window.confirm(`¿Eliminar el establo "${stable.name}"?`)
  if (!ok) return

  removeError.value = ''
  removingId.value = stable.id
  try {
    await stableStore.remove(activeFarmId.value, stable.id)
  } catch {
    removeError.value = stableStore.error ?? 'No se pudo eliminar el establo.'
  } finally {
    removingId.value = null
  }
}
</script>

<template>
  <div class="stables-page">
    <header class="stables-page__header">
      <div>
        <h1 class="stables-page__title">Establos</h1>
        <p class="stables-page__subtitle">
          Gestiona los establos de la partida activa y su ocupación por especie.
        </p>
      </div>
      <AppButton :disabled="!activeFarmId" @click="openCreate">
        Nuevo establo
      </AppButton>
    </header>

    <GlassCard v-if="!activeFarmId">
      <p class="stables-page__empty">
        Selecciona o crea una partida activa para gestionar sus establos.
      </p>
    </GlassCard>

    <template v-else>
      <p v-if="loadError" class="stables-page__error" role="alert">
        {{ loadError }}
      </p>
      <p v-if="removeError" class="stables-page__error" role="alert">
        {{ removeError }}
      </p>

      <StablesSummary v-if="stables.length" :stables="stables" />

      <GlassCard flush>
        <template #header>
          <h2 class="stables-page__card-title">Listado de establos</h2>
        </template>

        <DataTable
          :columns="columns"
          :rows="stables"
          row-key="id"
          caption="Establos de la partida activa"
        >
          <template #cell-species="{ row }">
            {{ speciesLabel((row as Stable).species) }}
          </template>

          <template #cell-utilization="{ row }">
            {{ rowPct(row as Stable) }}
          </template>

          <template #cell-actions="{ row }">
            <div class="stables-page__actions">
              <AppButton
                variant="ghost"
                size="sm"
                :disabled="removingId !== null"
                @click="openEdit(row as Stable)"
              >
                Editar
              </AppButton>
              <AppButton
                variant="danger"
                size="sm"
                :loading="removingId === (row as Stable).id"
                :disabled="removingId !== null && removingId !== (row as Stable).id"
                @click="onDelete(row as Stable)"
              >
                Eliminar
              </AppButton>
            </div>
          </template>

          <template #empty>
            <span v-if="loading">Cargando establos…</span>
            <span v-else>Aún no hay establos. Crea el primero.</span>
          </template>
        </DataTable>
      </GlassCard>
    </template>

    <StableFormModal
      v-if="activeFarmId"
      :open="modalOpen"
      :farm-id="activeFarmId"
      :editing="editingStable"
      @close="modalOpen = false"
      @saved="onSaved"
    />
  </div>
</template>

<style scoped lang="scss">
.stables-page {
  display: flex;
  flex-direction: column;
  gap: $space-lg;

  &__header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: $space-md;
  }

  &__title {
    margin: 0;
    font-size: 1.75rem;
    color: var(--text-strong);
  }

  &__subtitle {
    margin: $space-xs 0 0;
    color: var(--text-muted);
  }

  &__card-title {
    margin: 0;
    font-size: 1.125rem;
    color: var(--text-strong);
  }

  &__empty {
    margin: 0;
    color: var(--text-muted);
  }

  &__error {
    margin: 0;
    padding: $space-sm $space-md;
    border: 1px solid var(--danger);
    border-radius: var(--radius-md);
    background: rgba(255, 71, 87, 0.12);
    color: var(--danger);
    font-size: 0.875rem;
  }

  &__actions {
    display: inline-flex;
    gap: $space-sm;
    justify-content: flex-end;
  }
}
</style>
