<script setup lang="ts">
// features/data-migration/ui/MigratePanel — the migration UI (H8). Two sections:
//
//   EXPORT (H8.1): discover / type a prototype IndexedDB DB name and download a
//   PrototypeExport JSON (best-effort dump of the prototype's stores).
//
//   IMPORT (H8.2): upload a PrototypeExport JSON, give the new farm a name, and
//   run importPrototype — then show the ImportReport (created counts, unresolved
//   crops, warnings, errors).
//
// FSD: this feature component talks to its own lib (export/import) and shared/ui.
// No $fetch here; the importer goes through entities via its injected deps.
import { computed, onMounted, ref } from 'vue'
import { AppButton, AppInput, AppSelect, GlassCard } from '~/shared/ui'
import type { SelectOption } from '~/shared/ui'

import {
  DEFAULT_PROTOTYPE_DB_NAME,
  downloadJson,
  exportFromIndexedDb,
  isIndexedDbAvailable,
  listPrototypeDatabases,
} from '../lib/exportIndexedDb'
import { importPrototype } from '../lib/importMigration'
import { parsePrototypeExport } from '../model/types'
import type { ImportReport, PrototypeExport } from '../model/types'

// --- Export state ------------------------------------------------------------
const dbName = ref(DEFAULT_PROTOTYPE_DB_NAME)
const candidateDbs = ref<string[]>([])
const exporting = ref(false)
const exportError = ref('')
const exportInfo = ref('')

const idbAvailable = isIndexedDbAvailable()

const dbOptions = computed<SelectOption[]>(() =>
  candidateDbs.value.map((name) => ({ label: name, value: name })),
)

onMounted(async () => {
  if (!idbAvailable) return
  candidateDbs.value = await listPrototypeDatabases()
  // Pre-select the first discovered DB if our default is not among them.
  if (candidateDbs.value.length > 0 && !candidateDbs.value.includes(dbName.value)) {
    dbName.value = candidateDbs.value[0] ?? dbName.value
  }
})

async function onExport() {
  exportError.value = ''
  exportInfo.value = ''
  const name = dbName.value.trim()
  if (!name) {
    exportError.value = 'Indica el nombre de la base de datos a exportar.'
    return
  }
  exporting.value = true
  try {
    const data = await exportFromIndexedDb(name)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadJson(data, `fs25-planner-export-${stamp}.json`)
    exportInfo.value = `Exportados ${data.fields.length} campo(s)${
      data.machinery ? `, ${data.machinery.length} máquina(s)` : ''
    }${data.stables ? `, ${data.stables.length} establo(s)` : ''}.`
  } catch (err) {
    exportError.value = err instanceof Error ? err.message : 'No se pudo exportar la base de datos.'
  } finally {
    exporting.value = false
  }
}

// --- Import state ------------------------------------------------------------
const farmName = ref('Partida importada')
const parsed = ref<PrototypeExport | null>(null)
const fileName = ref('')
const importError = ref('')
const importing = ref(false)
const report = ref<ImportReport | null>(null)

const canImport = computed(() => parsed.value !== null && farmName.value.trim().length > 0)

async function onFileChange(event: Event) {
  importError.value = ''
  report.value = null
  parsed.value = null
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  fileName.value = file.name
  try {
    const text = await file.text()
    const json: unknown = JSON.parse(text)
    parsed.value = parsePrototypeExport(json)
  } catch (err) {
    parsed.value = null
    importError.value =
      err instanceof Error ? `Archivo inválido: ${err.message}` : 'No se pudo leer el archivo.'
  }
}

async function onImport() {
  if (!parsed.value) return
  importError.value = ''
  report.value = null
  importing.value = true
  try {
    report.value = await importPrototype(parsed.value, { farmName: farmName.value.trim() })
  } catch (err) {
    importError.value =
      err instanceof Error ? `Falló la importación: ${err.message}` : 'Falló la importación.'
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="migrate-panel">
    <!-- EXPORT (H8.1) -->
    <GlassCard title="Exportar desde el prototipo" subtitle="Genera un JSON con los datos guardados en IndexedDB del prototipo.">
      <p v-if="!idbAvailable" class="migrate-panel__warn" role="alert">
        Este navegador no expone IndexedDB; abre esta página en el navegador donde usabas el prototipo.
      </p>

      <div class="migrate-panel__row">
        <AppSelect
          v-if="dbOptions.length > 0"
          v-model="dbName"
          label="Base de datos detectada"
          :options="dbOptions"
          helper="Elige la base de datos del prototipo o escribe su nombre abajo."
        />
        <AppInput
          v-model="dbName"
          label="Nombre de la base de datos"
          placeholder="fs25-planner"
          helper="Si no se detecta automáticamente, escribe el nombre exacto de la base IndexedDB."
        />
      </div>

      <p v-if="exportError" class="migrate-panel__error" role="alert">{{ exportError }}</p>
      <p v-if="exportInfo" class="migrate-panel__info">{{ exportInfo }}</p>

      <template #footer>
        <AppButton :loading="exporting" :disabled="!idbAvailable" @click="onExport">
          Exportar JSON
        </AppButton>
      </template>
    </GlassCard>

    <!-- IMPORT (H8.2) -->
    <GlassCard title="Importar a una partida" subtitle="Sube el JSON exportado y crea una partida nueva con tus datos.">
      <div class="migrate-panel__field">
        <label class="migrate-panel__label" for="migrate-file">Archivo JSON exportado</label>
        <input
          id="migrate-file"
          class="migrate-panel__file"
          type="file"
          accept="application/json,.json"
          @change="onFileChange"
        >
        <p v-if="fileName" class="migrate-panel__info">Cargado: {{ fileName }}</p>
      </div>

      <AppInput
        v-model="farmName"
        label="Nombre de la partida"
        placeholder="Partida importada"
        required
      />

      <p v-if="importError" class="migrate-panel__error" role="alert">{{ importError }}</p>

      <!-- Import report -->
      <div v-if="report" class="migrate-panel__report">
        <h3 class="migrate-panel__report-title">Resultado de la importación</h3>
        <ul class="migrate-panel__counts">
          <li>Campos creados: <strong>{{ report.created.fields }}</strong></li>
          <li>Establos creados: <strong>{{ report.created.stables }}</strong></li>
          <li>Máquinas creadas: <strong>{{ report.created.machinery }}</strong></li>
          <li>Configs de animales: <strong>{{ report.created.animalConfigs }}</strong></li>
        </ul>

        <div v-if="report.unresolvedCrops.length > 0" class="migrate-panel__section">
          <p class="migrate-panel__section-title">Cultivos no resueltos (campos creados sin cultivo):</p>
          <ul class="migrate-panel__list">
            <li v-for="u in report.unresolvedCrops" :key="`${u.fieldNumber}-${u.name}`">
              Campo {{ u.fieldNumber }}: «{{ u.name }}»
            </li>
          </ul>
        </div>

        <div v-if="report.warnings.length > 0" class="migrate-panel__section">
          <p class="migrate-panel__section-title">Avisos:</p>
          <ul class="migrate-panel__list">
            <li v-for="(w, i) in report.warnings" :key="`w-${i}`">{{ w }}</li>
          </ul>
        </div>

        <div v-if="report.errors.length > 0" class="migrate-panel__section migrate-panel__section--error">
          <p class="migrate-panel__section-title">Errores (omitidos, no detuvieron la importación):</p>
          <ul class="migrate-panel__list">
            <li v-for="(e, i) in report.errors" :key="`e-${i}`">{{ e }}</li>
          </ul>
        </div>
      </div>

      <template #footer>
        <AppButton :loading="importing" :disabled="!canImport" @click="onImport">
          Importar
        </AppButton>
      </template>
    </GlassCard>
  </div>
</template>

<style scoped lang="scss">
.migrate-panel {
  display: flex;
  flex-direction: column;
  gap: $space-lg;

  &__row {
    display: grid;
    grid-template-columns: 1fr;
    gap: $space-md;

    @media (min-width: 640px) {
      grid-template-columns: 1fr 1fr;
    }
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: $space-xs;
  }

  &__label {
    color: var(--text);
    font-size: 0.875rem;
    font-weight: 600;
  }

  &__file {
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  &__warn {
    margin: 0;
    padding: $space-sm $space-md;
    border: 1px solid var(--accent, #ffa502);
    border-radius: var(--radius-md);
    background: rgba(255, 165, 2, 0.12);
    color: var(--text);
    font-size: 0.875rem;
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

  &__info {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  &__report {
    display: flex;
    flex-direction: column;
    gap: $space-md;
    padding: $space-md;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    background: var(--glass-bg);
  }

  &__report-title {
    margin: 0;
    font-size: 1rem;
    color: var(--text-strong);
  }

  &__counts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-xs $space-md;
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--text);
    font-size: 0.9375rem;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: $space-xs;

    &--error {
      color: var(--danger);
    }
  }

  &__section-title {
    margin: 0;
    font-weight: 600;
    font-size: 0.875rem;
  }

  &__list {
    margin: 0;
    padding-left: $space-lg;
    font-size: 0.875rem;
    color: var(--text-muted);
  }
}
</style>
