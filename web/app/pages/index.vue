<script setup lang="ts">
// pages/index — the dashboard. Ensures the active farm + its catalog, fields and
// stables are loaded, then renders the farm-summary widget. When the user has no
// partidas yet it shows an empty state that opens the farm manage modal to
// create the first one. Uses the default layout (app shell with sidebar) and is
// behind the global auth guard.
//
// Data loading lives here (the host), not in the presentational widget: on mount
// we load the farms list, resolve the active one, then load that farm's catalog
// + fields + stables. A watcher reloads farm-scoped data whenever the active
// farm changes (e.g. via the sidebar FarmSwitcher).
import { computed, onMounted, ref, watch } from 'vue'
import { GlassCard, AppButton } from '~/shared/ui'
import { useFarmStore } from '~/entities/farm'
import { useFieldStore } from '~/entities/field'
import { useStableStore } from '~/entities/stable'
import { useCatalogStore } from '~/entities/catalog'
import { FarmManageModal } from '~/features/farm-switcher'
import { FarmSummary } from '~/widgets/farm-summary'

const farmStore = useFarmStore()
const fieldStore = useFieldStore()
const stableStore = useStableStore()
const catalogStore = useCatalogStore()

const initializing = ref(true)
const loadError = ref('')
const createOpen = ref(false)

const activeFarm = computed(() => farmStore.activeFarm)
const hasFarms = computed(() => farmStore.hasFarms)

/** Load the catalog, fields and stables for a given farm. */
async function loadFarmData(farmId: string, gameVersionId: string | null) {
  await Promise.all([
    gameVersionId ? catalogStore.load(gameVersionId) : Promise.resolve(),
    fieldStore.load(farmId),
    stableStore.load(farmId),
  ])
}

/** Initial load: farms list → resolve active → load its scoped data. */
async function initialize() {
  initializing.value = true
  loadError.value = ''
  try {
    await farmStore.loadFarms()
    const activeId = await farmStore.ensureActive()
    if (activeId) {
      const farm = farmStore.farmById(activeId)
      await loadFarmData(activeId, farm?.gameVersionId ?? null)
    } else {
      fieldStore.reset()
      stableStore.reset()
    }
  } catch {
    loadError.value = farmStore.error ?? 'No se pudieron cargar los datos de la partida'
  } finally {
    initializing.value = false
  }
}

onMounted(initialize)

// Reload farm-scoped data whenever the active farm changes (sidebar switcher,
// create/delete). Skips the very first run (handled by initialize()).
watch(
  () => farmStore.activeFarmId,
  async (farmId, previous) => {
    if (farmId === previous) return
    if (initializing.value) return
    if (!farmId) {
      fieldStore.reset()
      stableStore.reset()
      return
    }
    const farm = farmStore.farmById(farmId)
    try {
      await loadFarmData(farmId, farm?.gameVersionId ?? null)
    } catch {
      loadError.value = farmStore.error ?? 'No se pudieron cargar los datos de la partida'
    }
  },
)

/**
 * Empty-state create flow: a farm was just created. Adopt it as the active farm;
 * the `activeFarmId` watcher then loads its catalog/fields/stables (no double
 * load). The modal handles its own close.
 */
async function onFarmCreated() {
  createOpen.value = false
  const farms = farmStore.farms
  const newest = farms[farms.length - 1]
  if (newest && farmStore.activeFarmId !== newest.id) {
    await farmStore.setActiveFarm(newest.id)
  }
}
</script>

<template>
  <div class="dashboard">
    <header class="dashboard__header">
      <h1 class="dashboard__title">
        {{ activeFarm ? activeFarm.name : 'Dashboard' }}
      </h1>
      <p class="dashboard__subtitle">
        {{
          activeFarm
            ? 'Resumen de tu partida'
            : 'Crea o selecciona una partida para empezar'
        }}
      </p>
    </header>

    <p v-if="loadError" class="dashboard__error" role="alert">{{ loadError }}</p>

    <p v-if="initializing" class="dashboard__loading">Cargando partida…</p>

    <template v-else>
      <FarmSummary v-if="activeFarm" />

      <GlassCard
        v-else
        title="Aún no tienes una partida"
        subtitle="Trabajarás siempre sobre una partida activa"
      >
        <p class="dashboard__note">
          Crea tu primera partida para empezar a gestionar campos, establos y
          maquinaria, y ver el resumen económico de tus cultivos.
        </p>
        <template #footer>
          <AppButton @click="createOpen = true">Crear partida</AppButton>
        </template>
      </GlassCard>
    </template>

    <FarmManageModal
      :open="createOpen"
      :farm="null"
      @close="createOpen = false"
      @saved="onFarmCreated"
    />
  </div>
</template>

<style scoped lang="scss">
.dashboard {
  display: flex;
  flex-direction: column;
  gap: $space-lg;

  &__header {
    display: flex;
    flex-direction: column;
    gap: $space-xs;
  }

  &__title {
    margin: 0;
    font-size: 1.75rem;
    color: var(--text-strong);
  }

  &__subtitle {
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

  &__loading {
    margin: 0;
    color: var(--text-muted);
  }

  &__note {
    margin: 0;
    color: var(--text-muted);
    line-height: 1.5;
  }
}
</style>
