<script setup lang="ts">
// pages/speed-calculator — work-time (speed) calculator (H7.6).
//
// The user picks a field (or types a hectare figure), sets an efficiency factor
// (0.5..1) and toggles which machines work the field. The page computes the
// total work time and a per-machine throughput breakdown via the PURE
// shared/lib/engine.workSpeedProjection (no store/network inside the engine).
//
// State (WorkSpeedState: hectares, selectedFieldId, efficiency,
// activeMachineryIds) is persisted per farm under the `work_speed` tool key via
// shared/api: loaded on mount (GET, 404-tolerant) and saved (PUT) on change,
// debounced. Orphan machinery ids (deleted machines) are dropped on load.
//
// FSD: pages compose entity stores (farm/field/machinery) + shared/ui +
// shared/lib/engine + shared/api. We never call $fetch directly.
import { computed, onMounted, ref, watch } from 'vue'
import {
  GlassCard,
  StatCard,
  AppButton,
  AppInput,
  AppSelect,
  FormField,
} from '~/shared/ui'
import type { SelectOption } from '~/shared/ui'
import { getData, put, isApiError } from '~/shared/api'
import { useFarmStore } from '~/entities/farm'
import { useFieldStore } from '~/entities/field'
import { useMachineryStore } from '~/entities/machinery'
import {
  workSpeedProjection,
  clampEfficiency,
  MIN_EFFICIENCY,
  MAX_EFFICIENCY,
} from '~/shared/lib/engine'
import type { SpeedMachineInput, WorkSpeedResult } from '~/shared/lib/engine'

/** Persisted shape (docs/openapi.yaml WorkSpeedState). */
interface WorkSpeedState {
  hectares: number | null
  selectedFieldId: string | null
  efficiency: number
  activeMachineryIds: string[]
}

const TOOL_KEY = 'work_speed'
const SAVE_DEBOUNCE_MS = 600

const farmStore = useFarmStore()
const fieldStore = useFieldStore()
const machineryStore = useMachineryStore()

// ── Reactive form state ──────────────────────────────────────────────────────
/** Empty string = "no field" (manual hectares). AppSelect emits string|number. */
const selectedFieldId = ref<string>('')
/** Free-text hectares; kept as a string so the input can be cleared. */
const hectaresInput = ref<string>('')
const efficiency = ref<number>(0.85)
/** Set of currently-active machine ids. */
const activeMachineryIds = ref<Set<string>>(new Set())

const loading = ref(false)
const saving = ref(false)
const errorMessage = ref<string | null>(null)
/** Guards the persistence watcher while we hydrate from the server. */
const hydrating = ref(true)

// ── Derived data ─────────────────────────────────────────────────────────────
const activeFarmId = computed(() => farmStore.activeFarmId)

const fieldOptions = computed<SelectOption[]>(() => [
  { label: 'Introducir hectáreas manualmente', value: '' },
  ...fieldStore.fields.map((f) => ({
    label: `Campo ${f.fieldNumber} (${formatNumber(f.hectares)} ha)`,
    value: f.id,
  })),
])

/** The field object behind selectedFieldId, if any. */
const selectedField = computed(() =>
  selectedFieldId.value ? fieldStore.fieldById(selectedFieldId.value) ?? null : null,
)

/**
 * Effective hectares to work: the selected field's area when a field is picked,
 * otherwise the manual input (parsed). null when nothing usable is entered.
 */
const hectares = computed<number | null>(() => {
  if (selectedField.value) return selectedField.value.hectares
  const n = Number.parseFloat(hectaresInput.value)
  return Number.isFinite(n) && n > 0 ? n : null
})

/** Machines selected AND still present in the store, in store order. */
const selectedMachines = computed<SpeedMachineInput[]>(() =>
  machineryStore.machines
    .filter((m) => activeMachineryIds.value.has(m.id))
    .map((m) => ({
      id: m.id,
      name: m.name,
      workingWidthM: m.workingWidthM,
      workingSpeedKmh: m.workingSpeedKmh,
    })),
)

/** Work-time projection (recomputed whenever any input changes). */
const result = computed<WorkSpeedResult>(() =>
  workSpeedProjection({
    hectares: hectares.value ?? 0,
    efficiency: efficiency.value,
    machines: selectedMachines.value,
  }),
)

const hasMachines = computed(() => machineryStore.machines.length > 0)
const hasResult = computed(() => result.value.workHours !== null)

const workTimeLabel = computed(() => {
  const { workHours, hours, minutes } = result.value
  if (workHours === null || hours === null || minutes === null) return '—'
  return `${hours} h ${String(minutes).padStart(2, '0')} min`
})

const efficiencyPercentLabel = computed(() => `${Math.round(efficiency.value * 100)} %`)

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

function toggleMachine(id: string): void {
  const next = new Set(activeMachineryIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  activeMachineryIds.value = next
}

function onEfficiencyInput(event: Event): void {
  const raw = Number.parseFloat((event.target as HTMLInputElement).value)
  efficiency.value = clampEfficiency(raw)
}

// ── Persistence ──────────────────────────────────────────────────────────────
/** The current form distilled into the persisted WorkSpeedState shape. */
function buildState(): WorkSpeedState {
  return {
    hectares: selectedFieldId.value ? null : hectares.value,
    selectedFieldId: selectedFieldId.value || null,
    efficiency: clampEfficiency(efficiency.value),
    activeMachineryIds: [...activeMachineryIds.value],
  }
}

/** Apply a loaded state, dropping machinery ids no longer in the store. */
function applyState(state: WorkSpeedState): void {
  efficiency.value = clampEfficiency(state.efficiency ?? 0.85)

  const knownIds = new Set(machineryStore.machines.map((m) => m.id))
  activeMachineryIds.value = new Set(
    (state.activeMachineryIds ?? []).filter((id) => knownIds.has(id)),
  )

  // Adopt the field only if it still exists; otherwise fall back to manual ha.
  if (state.selectedFieldId && fieldStore.fieldById(state.selectedFieldId)) {
    selectedFieldId.value = state.selectedFieldId
    hectaresInput.value = ''
  } else {
    selectedFieldId.value = ''
    hectaresInput.value =
      state.hectares != null && state.hectares > 0 ? String(state.hectares) : ''
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

async function persist(): Promise<void> {
  const farmId = activeFarmId.value
  if (!farmId) return
  saving.value = true
  errorMessage.value = null
  try {
    await put<unknown>(
      `/farms/${farmId}/calculator-states/${TOOL_KEY}`,
      buildState(),
    )
  } catch (err) {
    errorMessage.value = isApiError(err) ? err.message : 'No se pudo guardar el estado'
  } finally {
    saving.value = false
  }
}

/** Debounced auto-save; also exposed via an explicit "Guardar" button. */
function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void persist()
  }, SAVE_DEBOUNCE_MS)
}

async function saveNow(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  await persist()
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  loading.value = true
  hydrating.value = true
  errorMessage.value = null
  try {
    // Ensure an active farm exists (mirrors how other pages bootstrap).
    if (!farmStore.activeFarmId) {
      if (farmStore.farms.length === 0) await farmStore.loadFarms()
      await farmStore.ensureActive()
    }
    const farmId = farmStore.activeFarmId
    if (!farmId) return

    // Ensure the field + machinery stores point at the active farm.
    await Promise.all([
      fieldStore.farmId === farmId ? Promise.resolve() : fieldStore.load(farmId),
      machineryStore.farmId === farmId ? Promise.resolve() : machineryStore.load(farmId),
    ])

    // Load any persisted state (404 = none saved yet → keep defaults).
    try {
      const data = await getData<{ state: WorkSpeedState }>(
        `/farms/${farmId}/calculator-states/${TOOL_KEY}`,
      )
      if (data?.state) applyState(data.state)
    } catch (err) {
      if (!(isApiError(err) && err.status === 404)) {
        errorMessage.value = isApiError(err) ? err.message : 'No se pudo cargar el estado'
      }
    }
  } catch (err) {
    errorMessage.value = isApiError(err) ? err.message : 'No se pudieron cargar los datos'
  } finally {
    loading.value = false
    // Defer un-guarding so the hydration assignments above don't trigger a save.
    void Promise.resolve().then(() => {
      hydrating.value = false
    })
  }
}

onMounted(bootstrap)

// Auto-save whenever the persisted inputs change (after hydration).
watch(
  () => [
    selectedFieldId.value,
    hectaresInput.value,
    efficiency.value,
    [...activeMachineryIds.value].sort().join(','),
  ],
  () => {
    if (hydrating.value) return
    scheduleSave()
  },
)
</script>

<template>
  <div class="speed-calc">
    <header class="speed-calc__header">
      <h1 class="speed-calc__title">Calculadora de velocidad</h1>
      <p class="speed-calc__subtitle">
        Estima el tiempo de trabajo de un campo según la maquinaria seleccionada.
      </p>
    </header>

    <p v-if="errorMessage" class="speed-calc__error" role="alert">{{ errorMessage }}</p>

    <div class="speed-calc__grid">
      <!-- Inputs ------------------------------------------------------------ -->
      <GlassCard title="Parámetros" subtitle="Superficie y eficiencia de trabajo">
        <div class="speed-calc__form">
          <AppSelect
            v-model="selectedFieldId"
            label="Campo"
            :options="fieldOptions"
            helper="Elige un campo o introduce las hectáreas a mano."
          />

          <AppInput
            v-model="hectaresInput"
            label="Hectáreas"
            type="number"
            placeholder="0"
            :disabled="!!selectedFieldId"
            :helper="selectedFieldId
              ? 'Se usa la superficie del campo seleccionado.'
              : 'Superficie a trabajar (ha).'"
          />

          <FormField
            label="Eficiencia"
            control-id="speed-efficiency"
            :helper="`Factor de aprovechamiento (${efficiencyPercentLabel}). 100 % = sin pérdidas por giros/solapes.`"
          >
            <div class="speed-calc__slider">
              <input
                id="speed-efficiency"
                class="speed-calc__range"
                type="range"
                :min="MIN_EFFICIENCY"
                :max="MAX_EFFICIENCY"
                step="0.01"
                :value="efficiency"
                @input="onEfficiencyInput"
              />
              <span class="speed-calc__slider-value">{{ efficiencyPercentLabel }}</span>
            </div>
          </FormField>
        </div>
      </GlassCard>

      <!-- Machinery picker -------------------------------------------------- -->
      <GlassCard title="Maquinaria" subtitle="Equipos trabajando en paralelo">
        <p v-if="!hasMachines" class="speed-calc__empty">
          No hay maquinaria en esta partida. Añade equipos desde la sección
          «Maquinaria».
        </p>
        <ul v-else class="speed-calc__machines">
          <li v-for="m in machineryStore.machines" :key="m.id" class="speed-calc__machine">
            <label class="speed-calc__machine-row">
              <input
                type="checkbox"
                class="speed-calc__checkbox"
                :checked="activeMachineryIds.has(m.id)"
                @change="toggleMachine(m.id)"
              />
              <span class="speed-calc__machine-info">
                <span class="speed-calc__machine-name">{{ m.name }}</span>
                <span class="speed-calc__machine-meta">
                  {{ formatNumber(m.workingWidthM) }} m ·
                  {{ formatNumber(m.workingSpeedKmh) }} km/h ·
                  {{ formatNumber((m.workingWidthM * m.workingSpeedKmh) / 10) }} ha/h
                </span>
              </span>
            </label>
          </li>
        </ul>
      </GlassCard>
    </div>

    <!-- Results -------------------------------------------------------------- -->
    <GlassCard>
      <template #header>
        <div class="speed-calc__result-head">
          <div>
            <h2 class="speed-calc__result-title">Resultado</h2>
            <p class="speed-calc__result-sub">Tiempo estimado de trabajo</p>
          </div>
          <AppButton
            variant="ghost"
            size="sm"
            :loading="saving"
            :disabled="!activeFarmId"
            @click="saveNow"
          >
            Guardar
          </AppButton>
        </div>
      </template>

      <div class="speed-calc__stats">
        <StatCard
          label="Tiempo de trabajo"
          :value="workTimeLabel"
          :tone="hasResult ? 'success' : 'default'"
          :hint="hectares != null ? `${formatNumber(hectares)} ha` : 'Define superficie y maquinaria'"
        />
        <StatCard
          label="Rendimiento del equipo"
          :value="hasResult ? formatNumber(result.effectiveCapacityHaPerH) : '—'"
          unit="ha/h"
          :hint="`Nominal ${formatNumber(result.totalCapacityHaPerH)} ha/h × ${efficiencyPercentLabel}`"
        />
        <StatCard
          label="Máquinas activas"
          :value="selectedMachines.length"
          :hint="`de ${machineryStore.machines.length} disponibles`"
        />
      </div>

      <div v-if="result.perMachine.length" class="speed-calc__breakdown">
        <h3 class="speed-calc__breakdown-title">Desglose por máquina</h3>
        <table class="speed-calc__table">
          <thead>
            <tr>
              <th scope="col">Máquina</th>
              <th scope="col" class="speed-calc__num">ha/h efectivo</th>
              <th scope="col" class="speed-calc__num">% del equipo</th>
              <th scope="col" class="speed-calc__num">Tiempo en solitario</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in result.perMachine" :key="m.id">
              <td>{{ m.name }}</td>
              <td class="speed-calc__num">{{ formatNumber(m.effectiveCapacityHaPerH) }}</td>
              <td class="speed-calc__num">{{ formatNumber(m.shareOfTeam * 100, 1) }} %</td>
              <td class="speed-calc__num">
                {{ m.soloWorkHours != null ? `${formatNumber(m.soloWorkHours, 2)} h` : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="speed-calc__empty">
        Selecciona al menos una máquina y una superficie para ver el cálculo.
      </p>
    </GlassCard>
  </div>
</template>

<style scoped lang="scss">
.speed-calc {
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
    border-radius: var(--radius-md);
    background: var(--glass-bg);
    border: 1px solid var(--danger);
    color: var(--danger);
    font-size: 0.875rem;
  }

  &__grid {
    display: grid;
    gap: $space-lg;
    grid-template-columns: 1fr;

    @include respond-to('md') {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: $space-md;
  }

  &__slider {
    display: flex;
    align-items: center;
    gap: $space-md;
  }

  &__range {
    @include focus-ring;

    flex: 1 1 auto;
    accent-color: var(--primary);
    cursor: pointer;
  }

  &__slider-value {
    min-width: 3.5rem;
    text-align: right;
    color: var(--text-strong);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  &__machines {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: $space-xs;
  }

  &__machine-row {
    display: flex;
    align-items: center;
    gap: $space-md;
    padding: $space-sm $space-md;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition-fast);

    &:hover {
      background: var(--glass-bg-strong);
    }
  }

  &__checkbox {
    width: 1.1rem;
    height: 1.1rem;
    accent-color: var(--primary);
    cursor: pointer;
  }

  &__machine-info {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  &__machine-name {
    color: var(--text);
    font-weight: 600;
    font-size: 0.9375rem;
  }

  &__machine-meta {
    color: var(--text-muted);
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }

  &__result-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: $space-md;
  }

  &__result-title {
    margin: 0;
    font-size: 1.125rem;
    color: var(--text-strong);
  }

  &__result-sub {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  &__stats {
    display: grid;
    gap: $space-md;
    grid-template-columns: 1fr;

    @include respond-to('sm') {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  &__breakdown {
    margin-top: $space-lg;
    display: flex;
    flex-direction: column;
    gap: $space-sm;
  }

  &__breakdown-title {
    margin: 0;
    font-size: 1rem;
    color: var(--text-strong);
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;

    th,
    td {
      padding: $space-sm $space-md;
      border-bottom: 1px solid var(--glass-border);
      text-align: left;
    }

    th {
      color: var(--text-muted);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    td {
      color: var(--text);
    }
  }

  &__num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  &__empty {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.9rem;
    line-height: 1.5;
  }
}
</style>
