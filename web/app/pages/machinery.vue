<script setup lang="ts">
// pages/machinery — manage the active farm's machinery ("maquinaria"). Lists
// every machine in a table including the theoretical capacity (ha/h =
// width*speed/10), and wires create/edit/delete via the MachineFormModal
// (features/machinery-manage). Uses the default layout (sidebar) + global auth
// guard.
//
// Data flow (FSD): the active farm id comes from entities/farm; machines load
// via the machinery store. All mutations go through the modal -> store. No
// $fetch here.
import { computed, onMounted, ref, watch } from 'vue'
import { AppButton, DataTable, GlassCard } from '~/shared/ui'
import type { DataTableColumn } from '~/shared/ui'
import { useFarmStore } from '~/entities/farm'
import { useMachineryStore } from '~/entities/machinery'
import type { Machine } from '~/entities/machinery'
import { MachineFormModal, formatCapacity } from '~/features/machinery-manage'

const farmStore = useFarmStore()
const machineryStore = useMachineryStore()

const activeFarmId = computed(() => farmStore.activeFarmId)
const machines = computed(() => machineryStore.machines)
const loading = computed(() => machineryStore.loading)
const loadError = computed(() => machineryStore.error)

const modalOpen = ref(false)
const editingMachine = ref<Machine | null>(null)

const removingId = ref<string | null>(null)
const removeError = ref('')

const columns: DataTableColumn[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'workingWidthM', label: 'Anchura (m)', align: 'right', width: '8rem' },
  { key: 'workingSpeedKmh', label: 'Velocidad (km/h)', align: 'right', width: '9rem' },
  { key: 'capacity', label: 'Capacidad (ha/h)', align: 'right', width: '9rem' },
  { key: 'actions', label: '', align: 'right', width: '12rem' },
]

function rowCapacity(machine: Machine): string {
  return formatCapacity(machine.workingWidthM, machine.workingSpeedKmh)
}

async function reload() {
  const farmId = activeFarmId.value
  if (!farmId) return
  if (machineryStore.farmId === farmId && !loadError.value) return
  await machineryStore.load(farmId).catch(() => {
    // Error surfaced via store.error; swallow to keep the page mounted.
  })
}

onMounted(reload)
watch(activeFarmId, reload)

function openCreate() {
  editingMachine.value = null
  modalOpen.value = true
}

function openEdit(machine: Machine) {
  editingMachine.value = machine
  modalOpen.value = true
}

function onSaved() {
  modalOpen.value = false
}

async function onDelete(machine: Machine) {
  if (!activeFarmId.value) return
  const ok =
    typeof window === 'undefined' ||
    window.confirm(`¿Eliminar la máquina "${machine.name}"?`)
  if (!ok) return

  removeError.value = ''
  removingId.value = machine.id
  try {
    await machineryStore.remove(activeFarmId.value, machine.id)
  } catch {
    removeError.value = machineryStore.error ?? 'No se pudo eliminar la máquina.'
  } finally {
    removingId.value = null
  }
}
</script>

<template>
  <div class="machinery-page">
    <header class="machinery-page__header">
      <div>
        <h1 class="machinery-page__title">Maquinaria</h1>
        <p class="machinery-page__subtitle">
          Gestiona la maquinaria de la partida activa y su capacidad de trabajo.
        </p>
      </div>
      <AppButton :disabled="!activeFarmId" @click="openCreate">
        Nueva máquina
      </AppButton>
    </header>

    <GlassCard v-if="!activeFarmId">
      <p class="machinery-page__empty">
        Selecciona o crea una partida activa para gestionar su maquinaria.
      </p>
    </GlassCard>

    <template v-else>
      <p v-if="loadError" class="machinery-page__error" role="alert">
        {{ loadError }}
      </p>
      <p v-if="removeError" class="machinery-page__error" role="alert">
        {{ removeError }}
      </p>

      <GlassCard flush>
        <template #header>
          <h2 class="machinery-page__card-title">Listado de maquinaria</h2>
        </template>

        <DataTable
          :columns="columns"
          :rows="machines"
          row-key="id"
          caption="Maquinaria de la partida activa"
        >
          <template #cell-workingWidthM="{ row }">
            {{ (row as Machine).workingWidthM }}
          </template>

          <template #cell-workingSpeedKmh="{ row }">
            {{ (row as Machine).workingSpeedKmh }}
          </template>

          <template #cell-capacity="{ row }">
            {{ rowCapacity(row as Machine) }}
          </template>

          <template #cell-actions="{ row }">
            <div class="machinery-page__actions">
              <AppButton
                variant="ghost"
                size="sm"
                :disabled="removingId !== null"
                @click="openEdit(row as Machine)"
              >
                Editar
              </AppButton>
              <AppButton
                variant="danger"
                size="sm"
                :loading="removingId === (row as Machine).id"
                :disabled="removingId !== null && removingId !== (row as Machine).id"
                @click="onDelete(row as Machine)"
              >
                Eliminar
              </AppButton>
            </div>
          </template>

          <template #empty>
            <span v-if="loading">Cargando maquinaria…</span>
            <span v-else>Aún no hay maquinaria. Crea la primera.</span>
          </template>
        </DataTable>
      </GlassCard>
    </template>

    <MachineFormModal
      v-if="activeFarmId"
      :open="modalOpen"
      :farm-id="activeFarmId"
      :editing="editingMachine"
      @close="modalOpen = false"
      @saved="onSaved"
    />
  </div>
</template>

<style scoped lang="scss">
.machinery-page {
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
