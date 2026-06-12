<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { AppModal, AppButton, AppInput, AppSelect } from '~/shared/ui'
import type { SelectOption } from '~/shared/ui'
import { useCatalogStore } from '~/entities/catalog'
import { useProductionBuildingStore } from '~/entities/production-building'
import type {
  ProductionBuilding,
  UserChain,
} from '~/entities/production-building'
import type { ProductionChain } from '~/entities/catalog'
import { buildingErrorMessage } from '../lib/errorMessages'
import { BUILDING_TYPE_LABELS } from '../lib/buildingTypes'

const props = defineProps<{
  open: boolean
  farmId: string
  editing?: ProductionBuilding | null
}>()

const emit = defineEmits<{
  close: []
  saved: [building: ProductionBuilding]
}>()

const catalogStore = useCatalogStore()
const buildingStore = useProductionBuildingStore()

const name = ref('')
const buildingTypeSlug = ref('')
const notes = ref('')
const chains = ref<UserChain[]>([])
const errorMsg = ref<string | null>(null)

watch(
  () => [props.open, props.editing],
  () => {
    if (!props.open) return
    errorMsg.value = null
    if (props.editing) {
      name.value = props.editing.name
      buildingTypeSlug.value = props.editing.buildingTypeSlug
      notes.value = props.editing.notes ?? ''
      chains.value = props.editing.chains.map((c) => ({ ...c }))
    } else {
      name.value = ''
      buildingTypeSlug.value = ''
      notes.value = ''
      chains.value = []
    }
  },
  { immediate: true },
)

const buildingTypeOptions = computed<SelectOption[]>(() => {
  const types = catalogStore.current?.productionBuildingTypes ?? []
  if (types.length > 0) {
    return types.map((bt) => ({ value: bt.slug, label: bt.nameEs }))
  }
  return Object.entries(BUILDING_TYPE_LABELS).map(([value, label]) => ({ value, label }))
})

const availableCatalogChains = computed<ProductionChain[]>(() =>
  buildingTypeSlug.value
    ? catalogStore.productionChainsByBuildingType(buildingTypeSlug.value)
    : [],
)

const addedChainSlugs = computed<Set<string | null>>(() =>
  new Set(chains.value.map((c) => c.catalogChainSlug)),
)

function addCatalogChain(catalogChain: ProductionChain): void {
  chains.value.push({
    id: crypto.randomUUID(),
    catalogChainSlug: catalogChain.slug,
    name: catalogChain.nameEs,
    isActive: true,
    cyclesPerMonth: null,
    inputs: null,
    outputs: null,
  })
}

function addCustomChain(): void {
  chains.value.push({
    id: crypto.randomUUID(),
    catalogChainSlug: null,
    name: 'Receta personalizada',
    isActive: true,
    cyclesPerMonth: 100,
    inputs: [{ slug: '', quantityPerCycle: 1 }],
    outputs: [{ slug: '', quantityPerCycle: 1 }],
  })
}

function removeChain(chainId: string): void {
  chains.value = chains.value.filter((c) => c.id !== chainId)
}

function addIO(chainId: string, type: 'inputs' | 'outputs'): void {
  const chain = chains.value.find((c) => c.id === chainId)
  if (!chain) return
  if (!chain[type]) chain[type] = []
  chain[type]!.push({ slug: '', quantityPerCycle: 1 })
}

function removeIO(chainId: string, type: 'inputs' | 'outputs', index: number): void {
  const chain = chains.value.find((c) => c.id === chainId)
  if (!chain || !chain[type]) return
  chain[type]!.splice(index, 1)
}

function toggleOverrideRecipe(chain: UserChain): void {
  const catalogChain = chain.catalogChainSlug
    ? catalogStore.productionChainBySlug(chain.catalogChainSlug)
    : null

  if (chain.inputs === null) {
    chain.inputs = catalogChain
      ? catalogChain.inputs.map((io) => ({ ...io }))
      : [{ slug: '', quantityPerCycle: 1 }]
    chain.outputs = catalogChain
      ? catalogChain.outputs.map((io) => ({ ...io }))
      : [{ slug: '', quantityPerCycle: 1 }]
    chain.cyclesPerMonth = catalogChain?.cyclesPerMonth ?? 100
  } else {
    chain.inputs = null
    chain.outputs = null
    chain.cyclesPerMonth = null
  }
}

async function onSubmit(): Promise<void> {
  errorMsg.value = null
  const payload = {
    name: name.value.trim(),
    buildingTypeSlug: buildingTypeSlug.value,
    notes: notes.value.trim() || null,
    chains: chains.value,
  }
  try {
    let saved: ProductionBuilding
    if (props.editing) {
      saved = await buildingStore.update(props.farmId, props.editing.id, payload)
    } else {
      saved = await buildingStore.create(props.farmId, payload)
    }
    emit('saved', saved)
    emit('close')
  } catch (err) {
    errorMsg.value = buildingErrorMessage(err)
  }
}

const saving = computed(() => buildingStore.saving)
const title = computed(() => (props.editing ? 'Editar edificio' : 'Nuevo edificio de producción'))
</script>

<template>
  <AppModal :open="open" :title="title" :persistent="saving" @close="emit('close')">
    <form class="building-form" novalidate @submit.prevent="onSubmit">
      <p v-if="errorMsg" class="building-form__error" role="alert">
        {{ errorMsg }}
      </p>

      <AppInput
        v-model="name"
        label="Nombre"
        placeholder="Mi Molino"
        required
        :disabled="saving"
      />

      <AppSelect
        v-model="buildingTypeSlug"
        label="Tipo de edificio"
        :options="buildingTypeOptions"
        placeholder="Selecciona tipo…"
        required
        :disabled="saving"
      />

      <AppInput
        v-model="notes"
        label="Notas"
        placeholder="Notas opcionales…"
        :disabled="saving"
      />

      <!-- Chain editor — only shown once a building type is selected -->
      <div v-if="buildingTypeSlug" class="building-form__chains">
        <!-- Section header -->
        <div class="building-form__chains-header">
          <span class="building-form__section-title">Recetas</span>
          <AppButton size="sm" variant="ghost" type="button" @click="addCustomChain">
            + Custom (mod)
          </AppButton>
        </div>

        <!-- Catalog chain chips -->
        <div v-if="availableCatalogChains.length > 0" class="building-form__chips">
          <button
            v-for="cc in availableCatalogChains"
            :key="cc.slug"
            type="button"
            class="building-form__chip"
            :class="{ 'building-form__chip--added': addedChainSlugs.has(cc.slug) }"
            :disabled="addedChainSlugs.has(cc.slug)"
            @click="addCatalogChain(cc)"
          >
            + {{ cc.nameEs }}
          </button>
        </div>

        <!-- Chain list -->
        <div v-if="chains.length > 0" class="building-form__chain-list">
          <div
            v-for="chain in chains"
            :key="chain.id"
            class="building-form__chain-card"
          >
            <!-- Chain header row: checkbox + name + badge + remove -->
            <div class="building-form__chain-row">
              <input
                v-model="chain.isActive"
                type="checkbox"
                class="building-form__checkbox"
              />
              <input
                v-model="chain.name"
                type="text"
                class="building-form__chain-name"
                placeholder="Nombre de la receta"
              />
              <span
                v-if="!chain.catalogChainSlug"
                class="building-form__chain-badge"
              >
                Custom
              </span>
              <button
                type="button"
                class="building-form__chain-remove"
                @click="removeChain(chain.id)"
              >
                ×
              </button>
            </div>

            <!-- Override toggle for catalog chains -->
            <button
              v-if="chain.catalogChainSlug"
              type="button"
              class="building-form__override-btn"
              @click="toggleOverrideRecipe(chain)"
            >
              {{ chain.inputs !== null ? '↩ Usar catálogo' : '✏ Personalizar receta' }}
            </button>

            <!-- IO editor (custom chain or override active) -->
            <div v-if="chain.inputs !== null" class="building-form__io-editor">
              <label class="building-form__cycles-row">
                <span class="building-form__cycles-label">Ciclos/mes</span>
                <input
                  v-model.number="chain.cyclesPerMonth"
                  type="number"
                  class="building-form__cycles-input"
                  min="0.01"
                  step="0.1"
                />
              </label>

              <div class="building-form__io-grid">
                <!-- Inputs -->
                <div class="building-form__io-col">
                  <p class="building-form__io-heading building-form__io-heading--in">
                    Inputs / ciclo
                  </p>
                  <div
                    v-for="(io, i) in chain.inputs"
                    :key="i"
                    class="building-form__io-row"
                  >
                    <span
                      v-if="chain.catalogChainSlug !== null"
                      class="building-form__io-slug building-form__io-slug--label"
                    >{{ catalogStore.resolveIoLabel(io.slug) }}</span>
                    <input
                      v-else
                      v-model="io.slug"
                      type="text"
                      class="building-form__io-slug"
                      placeholder="slug"
                    />
                    <input
                      v-model.number="io.quantityPerCycle"
                      type="number"
                      class="building-form__io-qty"
                      min="0.001"
                      step="0.001"
                    />
                    <button
                      type="button"
                      class="building-form__io-remove"
                      @click="removeIO(chain.id, 'inputs', i)"
                    >
                      ×
                    </button>
                  </div>
                  <button
                    type="button"
                    class="building-form__io-add"
                    @click="addIO(chain.id, 'inputs')"
                  >
                    + input
                  </button>
                </div>

                <!-- Outputs -->
                <div class="building-form__io-col">
                  <p class="building-form__io-heading building-form__io-heading--out">
                    Outputs / ciclo
                  </p>
                  <div
                    v-for="(io, i) in chain.outputs"
                    :key="i"
                    class="building-form__io-row"
                  >
                    <span
                      v-if="chain.catalogChainSlug !== null"
                      class="building-form__io-slug building-form__io-slug--label"
                    >{{ catalogStore.resolveIoLabel(io.slug) }}</span>
                    <input
                      v-else
                      v-model="io.slug"
                      type="text"
                      class="building-form__io-slug"
                      placeholder="slug"
                    />
                    <input
                      v-model.number="io.quantityPerCycle"
                      type="number"
                      class="building-form__io-qty"
                      min="0.001"
                      step="0.001"
                    />
                    <button
                      type="button"
                      class="building-form__io-remove"
                      @click="removeIO(chain.id, 'outputs', i)"
                    >
                      ×
                    </button>
                  </div>
                  <button
                    type="button"
                    class="building-form__io-add"
                    @click="addIO(chain.id, 'outputs')"
                  >
                    + output
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p v-else class="building-form__chains-empty">
          Sin recetas. Añade una del catálogo o crea una custom.
        </p>
      </div>
    </form>

    <template #footer>
      <AppButton variant="ghost" :disabled="saving" @click="emit('close')">
        Cancelar
      </AppButton>
      <AppButton type="submit" :loading="saving" @click="onSubmit">
        {{ editing ? 'Guardar cambios' : 'Crear edificio' }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
// Shared raw-input style reused for chain name, cycles, IO slug/qty.
%raw-input {
  padding: $space-xs $space-sm;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg);
  color: var(--text);
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 1.4;

  &::placeholder { color: var(--text-muted); }
  &:focus { outline: none; border-color: var(--primary); background: var(--glass-bg-strong); }
}

%ghost-btn {
  padding: $space-xs $space-sm;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast);

  &:hover { color: var(--text); background: var(--glass-bg-strong); }
}

.building-form {
  display: flex;
  flex-direction: column;
  gap: $space-md;

  &__error {
    margin: 0;
    padding: $space-sm $space-md;
    border: 1px solid var(--danger);
    border-radius: var(--radius-md);
    background: rgba(255, 71, 87, 0.12);
    color: var(--danger);
    font-size: 0.875rem;
  }

  // ── Chain editor container ────────────────────────────────────────────────

  &__chains {
    display: flex;
    flex-direction: column;
    gap: $space-sm;
    padding: $space-md;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
  }

  &__chains-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
  }

  // ── Catalog chip buttons ──────────────────────────────────────────────────

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: $space-xs;
  }

  &__chip {
    @extend %ghost-btn;
    border-color: rgba(52, 211, 153, 0.4); // emerald tint
    color: rgb(110, 231, 183);

    &--added {
      border-color: var(--glass-border);
      color: var(--text-muted);
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:not(&--added):hover {
      background: rgba(52, 211, 153, 0.08);
    }
  }

  &__chains-empty {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.8125rem;
    text-align: center;
    padding: $space-sm 0;
  }

  // ── Chain card ────────────────────────────────────────────────────────────

  &__chain-list {
    display: flex;
    flex-direction: column;
    gap: $space-sm;
  }

  &__chain-card {
    display: flex;
    flex-direction: column;
    gap: $space-xs;
    padding: $space-sm $space-md;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    background: var(--glass-bg);
  }

  &__chain-row {
    display: flex;
    align-items: center;
    gap: $space-sm;
  }

  &__checkbox {
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
    accent-color: var(--primary);
    cursor: pointer;
  }

  &__chain-name {
    @extend %raw-input;
    flex: 1;
    min-width: 0;
  }

  &__chain-badge {
    flex-shrink: 0;
    padding: 0.1em $space-xs;
    border-radius: var(--radius-sm);
    background: rgba(251, 191, 36, 0.15); // amber tint
    color: rgb(252, 211, 77);
    font-size: 0.75rem;
    font-weight: 600;
  }

  &__chain-remove {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color var(--transition-fast), background var(--transition-fast);

    &:hover { color: var(--danger); background: rgba(255, 71, 87, 0.1); }
  }

  &__override-btn {
    align-self: flex-start;
    padding: 0;
    border: none;
    background: transparent;
    color: rgb(125, 211, 252); // sky-300
    font-size: 0.8125rem;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;

    &:hover { color: rgb(186, 230, 253); }
  }

  // ── IO editor (override / custom) ─────────────────────────────────────────

  &__io-editor {
    display: flex;
    flex-direction: column;
    gap: $space-sm;
    padding-top: $space-xs;
    border-top: 1px solid var(--glass-border);
    margin-top: $space-xs;
  }

  &__cycles-row {
    display: flex;
    align-items: center;
    gap: $space-sm;
  }

  &__cycles-label {
    flex-shrink: 0;
    font-size: 0.8125rem;
    color: var(--text-muted);
  }

  &__cycles-input {
    @extend %raw-input;
    width: 6rem;
    appearance: textfield;
    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button { display: none; }
  }

  &__io-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-sm;
  }

  &__io-col {
    display: flex;
    flex-direction: column;
    gap: $space-xs;
    min-width: 0;
  }

  &__io-heading {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;

    &--in  { color: rgb(252, 165, 165); } // red-300
    &--out { color: rgb(110, 231, 183); } // emerald-300
  }

  &__io-row {
    display: flex;
    align-items: center;
    gap: $space-xs;
  }

  &__io-slug {
    @extend %raw-input;
    flex: 1;
    min-width: 0;

    &--label {
      display: flex;
      align-items: center;
      color: var(--text-secondary);
      cursor: default;
      border-color: transparent;
      background: transparent;
    }
  }

  &__io-qty {
    @extend %raw-input;
    width: 4rem;
    flex-shrink: 0;
    // Hide native number spinner to save space; up/down via keyboard still works
    appearance: textfield;
    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button { display: none; }
  }

  &__io-remove {
    flex-shrink: 0;
    width: 1.4rem;
    height: 1.4rem;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover { color: var(--danger); }
  }

  &__io-add {
    @extend %ghost-btn;
    align-self: flex-start;
    font-size: 0.75rem;
  }
}
</style>
