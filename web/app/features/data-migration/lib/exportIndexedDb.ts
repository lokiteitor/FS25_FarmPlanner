// features/data-migration/lib/exportIndexedDb (H8.1) — best-effort IndexedDB
// exporter that runs in the browser and serializes the prototype's stored data
// into the documented {@link PrototypeExport} shape.
//
// ─────────────────────────────────────────────────────────────────────────────
// REAL PROTOTYPE INDEXEDDB SCHEMA  (verified against
// planner/planner/app/composables/useDB.ts + the pages that persist data):
//
//   DB name:  'fs25_farm_planner_db'  (DB_VERSION 1).
//
//   object store 'fields'  (keyPath 'id', autoIncrement; one record per field):
//     { id, fieldNumber, hectares, selectedCrop (SPANISH crop name, '' = fallow),
//       yieldBonus (decimal, e.g. 0.425), purchasePrice }
//     NOTE: the prototype has NO per-field silage flag.
//
//   object store 'settings'  (plain KV store: value stored under a string key).
//     The keys the prototype actually writes (grep of saveSetting):
//       'app_settings'      → { difficulty:'Easy'|'Normal'|'Hard', yieldBonus:number }
//       'global_settings'   → { sellPrice:'Baseline'|'MaxSeasonal' }  (older dumps
//                              may also carry difficulty here)
//       'registered_machinery' → Array<{ name, width, speed }>
//       'registered_stables'   → Array<{ name, type:'Cow'|'Chicken'|…, maxCapacity,
//                                        currentCount, settings? }>
//       'animal_cows' | 'animal_buffaloes' | 'animal_chickens' | 'animal_sheep'
//         | 'animal_goats' | 'animal_pigs' | 'animal_horses'
//                              → the raw per-species calculator inputs object
//                                (numCows/feedType 'TMR'/silageCrop 'Corn'/…).
//       'work_speed_calculator_data' → { hectares, selectedFieldId, efficiency,
//                                        activeToolNames[] }
//
// The reader is DEFENSIVE: it still accepts a few legacy aliases, a KV store OR a
// single settings record, and ignores anything it does not recognize. Per-species
// config translation (prototype encodings → the API inputs) happens in the
// importer (lib/importMigration); the exporter passes the raw inputs through.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AnimalSpecies,
  PrototypeExport,
  PrototypeField,
  PrototypeMachine,
  PrototypeSettings,
  PrototypeStable,
} from '../model/types'
import { DIFFICULTIES, SELL_PRICE_TYPES } from '../model/types'

/** The real prototype IndexedDB database name (planner useDB.ts DB_NAME). */
export const DEFAULT_PROTOTYPE_DB_NAME = 'fs25_farm_planner_db'

/** Prototype settings KV keys (verified against the prototype pages). */
const SETTINGS_KEYS = {
  appSettings: 'app_settings',
  globalSettings: 'global_settings',
  machinery: 'registered_machinery',
  stables: 'registered_stables',
  speedCalculator: 'work_speed_calculator_data',
} as const

/** Per-species `animal_<species>` settings keys, by API species. */
const ANIMAL_CONFIG_KEYS: Readonly<Record<AnimalSpecies, string>> = {
  cow: 'animal_cows',
  buffalo: 'animal_buffaloes',
  chicken: 'animal_chickens',
  sheep: 'animal_sheep',
  goat: 'animal_goats',
  pig: 'animal_pigs',
  horse: 'animal_horses',
}

const KNOWN_SPECIES: readonly AnimalSpecies[] = [
  'cow',
  'buffalo',
  'chicken',
  'sheep',
  'goat',
  'pig',
  'horse',
]

/** Prototype proto difficulty (PascalCase) → API difficulty. */
const PROTO_DIFFICULTY_TO_API: Readonly<Record<string, PrototypeSettings['difficulty']>> = {
  Easy: 'easy',
  Normal: 'normal',
  Hard: 'hard',
}

/** Prototype proto sell-price (PascalCase) → API sellPriceType. */
const PROTO_SELL_PRICE_TO_API: Readonly<Record<string, PrototypeSettings['sellPriceType']>> = {
  Baseline: 'baseline',
  MaxSeasonal: 'max_seasonal',
}

/** True when IndexedDB exists in this runtime (browser only). */
export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null
}

/**
 * List candidate prototype databases via `indexedDB.databases()` when the
 * browser supports it. Returns the database names (empty array when the API is
 * unavailable — e.g. older Firefox — so the UI can fall back to manual entry).
 */
export async function listPrototypeDatabases(): Promise<string[]> {
  if (!isIndexedDbAvailable()) return []
  const dbs = indexedDB as IDBFactory & {
    databases?: () => Promise<{ name?: string }[]>
  }
  if (typeof dbs.databases !== 'function') return []
  try {
    const list = await dbs.databases()
    return list
      .map((d) => d.name)
      .filter((n): n is string => typeof n === 'string' && n.length > 0)
  } catch {
    return []
  }
}

// --- small defensive accessors ----------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

/** First defined value among a set of candidate keys. */
function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) return row[k]
  }
  return undefined
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

// --- raw IndexedDB plumbing --------------------------------------------------

/** Open a database read-only (does not create it: version left unspecified). */
function openDb(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error(`Failed to open IndexedDB "${dbName}"`))
    req.onblocked = () => reject(new Error(`IndexedDB "${dbName}" is blocked`))
  })
}

/** Read every record of one object store as an array (empty if it does not exist). */
function readStore(db: IDBDatabase, storeName: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve([])
      return
    }
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.getAll()
    req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : [])
    req.onerror = () => reject(req.error ?? new Error(`Failed to read store "${storeName}"`))
  })
}

/**
 * Read the prototype `settings` store into a flat KV map. The real prototype is
 * a plain KV store (`store.put(value, key)`): `getAll()` returns the VALUES and
 * `getAllKeys()` the KEYS, in matching order, so we zip them. Also tolerates a
 * legacy keyPath store (`{ key/name/id, value }`) or a single object-bag record.
 */
function readKvStore(db: IDBDatabase, storeName: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve({})
      return
    }
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const valuesReq = store.getAll()
    const keysReq = store.getAllKeys()
    let values: unknown[] | undefined
    let keys: IDBValidKey[] | undefined

    const finish = () => {
      if (values === undefined || keys === undefined) return
      const kv: Record<string, unknown> = {}

      // Plain KV store: getAllKeys() lines up with getAll() by index.
      if (keys.length === values.length && keys.every((k) => typeof k === 'string')) {
        keys.forEach((k, i) => {
          kv[k as string] = values![i]
        })
        resolve(kv)
        return
      }

      // Legacy fallbacks: keyPath records, or a single object-bag record.
      for (const row of values) {
        const rec = asRecord(row)
        const key = rec.key ?? rec.name ?? rec.id
        if (typeof key === 'string' && 'value' in rec) {
          kv[key] = rec.value
        } else {
          for (const [k, v] of Object.entries(rec)) kv[k] = v
        }
      }
      resolve(kv)
    }

    valuesReq.onsuccess = () => {
      values = Array.isArray(valuesReq.result) ? valuesReq.result : []
      finish()
    }
    keysReq.onsuccess = () => {
      keys = Array.isArray(keysReq.result) ? keysReq.result : []
      finish()
    }
    valuesReq.onerror = () =>
      reject(valuesReq.error ?? new Error(`Failed to read KV store "${storeName}"`))
    keysReq.onerror = () =>
      reject(keysReq.error ?? new Error(`Failed to read KV store "${storeName}"`))
  })
}

// --- mappers (raw rows -> documented shape) ----------------------------------

function mapField(row: unknown, index: number): PrototypeField {
  const r = asRecord(row)
  const fieldNumber = toNumber(pick(r, ['fieldNumber', 'number', 'field', 'no'])) ?? index + 1
  const hectares = toNumber(pick(r, ['hectares', 'ha', 'size', 'area'])) ?? 0
  // The prototype stores the (Spanish) crop in `selectedCrop`; '' means fallow.
  const cropRaw = pick(r, ['selectedCrop', 'crop', 'cropName', 'cultivo', 'cropEs'])
  const crop = typeof cropRaw === 'string' && cropRaw.trim() !== '' ? cropRaw : null
  return {
    fieldNumber,
    hectares,
    crop,
    // The real prototype has no per-field silage flag; default false (importer
    // also forces fallow fields to non-silage).
    isSilage: false,
    yieldBonus: toNumber(pick(r, ['yieldBonus', 'bonus'])) ?? null,
    purchasePrice: toNumber(pick(r, ['purchasePrice', 'price', 'precio'])) ?? null,
  }
}

function mapMachine(row: unknown): PrototypeMachine {
  const r = asRecord(row)
  return {
    name: String(pick(r, ['name', 'nombre']) ?? 'Máquina'),
    // The prototype machinery store uses { name, width, speed }.
    workingWidthM: toNumber(pick(r, ['width', 'workingWidthM', 'anchura'])) ?? 0,
    workingSpeedKmh: toNumber(pick(r, ['speed', 'workingSpeedKmh', 'velocidad'])) ?? 0,
  }
}

function mapStable(row: unknown): PrototypeStable {
  const r = asRecord(row)
  // The prototype stable record uses `type` (PascalCase: 'Cow'|'Chicken'|…) and
  // an optional `settings` object (the full per-stable calculator inputs). We
  // keep `species` as the RAW prototype value; the importer normalizes/translates.
  return {
    name: String(pick(r, ['name', 'nombre']) ?? 'Establo'),
    species: String(pick(r, ['type', 'species', 'especie', 'animal']) ?? ''),
    maxCapacity: toNumber(pick(r, ['maxCapacity', 'capacity', 'capacidad'])) ?? 0,
    currentCount: toNumber(pick(r, ['currentCount', 'count', 'cantidad'])) ?? 0,
    config: asRecord(pick(r, ['settings', 'config', 'inputs'])),
  }
}

/**
 * Map the prototype settings KV map onto {@link PrototypeSettings}.
 *   - difficulty / yieldBonus come from `app_settings`.
 *   - sellPriceType comes from `global_settings.sellPrice`.
 * Both prototype settings objects use PascalCase enums (Easy/Normal/Hard,
 * Baseline/MaxSeasonal) which we translate to the API encoding here so the
 * importer receives the contract values directly.
 */
function mapSettings(kv: Record<string, unknown>): PrototypeSettings {
  const settings: PrototypeSettings = {}

  const app = asRecord(kv[SETTINGS_KEYS.appSettings])
  const global = asRecord(kv[SETTINGS_KEYS.globalSettings])

  // difficulty: app_settings first, then a legacy global_settings.difficulty.
  const rawDifficulty = pick(app, ['difficulty']) ?? pick(global, ['difficulty']) ?? kv.difficulty
  if (typeof rawDifficulty === 'string') {
    const mapped = PROTO_DIFFICULTY_TO_API[rawDifficulty]
    if (mapped) {
      settings.difficulty = mapped
    } else if ((DIFFICULTIES as readonly string[]).includes(rawDifficulty)) {
      // Already in API encoding (e.g. a re-export).
      settings.difficulty = rawDifficulty as PrototypeSettings['difficulty']
    }
  }

  const yieldBonus = toNumber(pick(app, ['yieldBonus']) ?? kv.yieldBonus)
  if (yieldBonus !== undefined) settings.yieldBonus = yieldBonus

  // sellPriceType: global_settings.sellPrice (PascalCase) → API encoding.
  const rawSell =
    pick(global, ['sellPrice', 'sellPriceType']) ??
    pick(app, ['sellPrice', 'sellPriceType']) ??
    kv.sellPriceType ??
    kv.sellPrice
  if (typeof rawSell === 'string') {
    const mapped = PROTO_SELL_PRICE_TO_API[rawSell]
    if (mapped) {
      settings.sellPriceType = mapped
    } else if ((SELL_PRICE_TYPES as readonly string[]).includes(rawSell)) {
      settings.sellPriceType = rawSell as PrototypeSettings['sellPriceType']
    }
  }

  const mapName = pick(app, ['mapName', 'map']) ?? kv.mapName ?? kv.map
  if (typeof mapName === 'string' && mapName.trim() !== '') settings.mapName = mapName

  return settings
}

/**
 * Extract per-species calculator configs from the settings KV map. Reads the
 * real `animal_<species>` keys (animal_cows, animal_buffaloes, …) and keeps the
 * RAW prototype inputs object; the importer translates them to the API shape.
 * Also accepts an explicit `animalConfigs` bag (a re-export of this format).
 */
function mapAnimalConfigs(
  kv: Record<string, unknown>,
): Record<string, Record<string, unknown>> | undefined {
  const out: Record<string, Record<string, unknown>> = {}

  for (const species of KNOWN_SPECIES) {
    const value = kv[ANIMAL_CONFIG_KEYS[species]]
    if (value && typeof value === 'object') out[species] = asRecord(value)
  }

  // An explicit nested bag, if a prior export of this format is re-imported.
  const bag = kv.animalConfigs
  if (bag && typeof bag === 'object') {
    for (const [species, cfg] of Object.entries(asRecord(bag))) {
      if (cfg && typeof cfg === 'object') out[species] = asRecord(cfg)
    }
  }

  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Export the prototype data of `dbName` into a {@link PrototypeExport}. Reads the
 * `fields` object store and the `settings` KV store (machinery, stables, animal
 * configs and global settings all live under settings keys). Missing keys yield
 * empty sections rather than errors.
 *
 * Throws only when the database cannot be opened.
 */
export async function exportFromIndexedDb(dbName: string): Promise<PrototypeExport> {
  if (!isIndexedDbAvailable()) {
    throw new Error('IndexedDB no está disponible en este navegador.')
  }

  const db = await openDb(dbName)
  try {
    const [fieldRows, settingsKv] = await Promise.all([
      readStore(db, 'fields'),
      readKvStore(db, 'settings'),
    ])

    const fields = fieldRows.map(mapField)

    const machineRows = settingsKv[SETTINGS_KEYS.machinery]
    const machinery = (Array.isArray(machineRows) ? machineRows : []).map(mapMachine)

    const stableRows = settingsKv[SETTINGS_KEYS.stables]
    const stables = (Array.isArray(stableRows) ? stableRows : []).map(mapStable)

    const settings = mapSettings(settingsKv)
    const animalConfigs = mapAnimalConfigs(settingsKv)

    const result: PrototypeExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      fields,
    }
    if (machinery.length > 0) result.machinery = machinery
    if (stables.length > 0) result.stables = stables
    if (animalConfigs) result.animalConfigs = animalConfigs
    return result
  } finally {
    db.close()
  }
}

/**
 * Save any JSON-serializable value as a downloaded file (Blob + anchor click).
 * Browser-only; no-op-safe guards keep it from throwing under SSR/tests.
 */
export function downloadJson(data: unknown, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}
