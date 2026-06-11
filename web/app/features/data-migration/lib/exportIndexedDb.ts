// features/data-migration/lib/exportIndexedDb (H8.1) — best-effort IndexedDB
// exporter that runs in the browser and serializes the prototype's stored data
// into the documented {@link PrototypeExport} shape.
//
// ─────────────────────────────────────────────────────────────────────────────
// ASSUMED PROTOTYPE INDEXEDDB SCHEMA  (the prototype `planner/` is NOT in this
// repo, so this is a documented best-effort guess; the DB name is supplied by
// the caller — use {@link listPrototypeDatabases} to discover candidates):
//
//   DB name:  unknown → caller supplies (default guess: 'fs25-planner').
//
//   object store 'fields'  (one record per field):
//     { id?, fieldNumber|number|field, hectares|ha|size, crop|cropName|cultivo
//       (SPANISH crop name), isSilage|silage, yieldBonus, purchasePrice|price }
//
//   object store 'settings' (KV store: a single record, OR keyPath records):
//     keys (from useGlobalSettings):
//       difficulty | yieldBonus | sellPriceType | mapName
//     plus per-species calculator configs keyed like:
//       cow_calculator_config, buffalo_calculator_config, …, horse_calculator_config
//       (value = the raw calculator inputs object for that species).
//
//   object store 'machinery' (optional, one record per machine):
//     { name, workingWidthM|width, workingSpeedKmh|speed }
//
//   object store 'stables' (optional, one record per stable):
//     { name, species, maxCapacity|capacity, currentCount|count, config }
//
// The reader is intentionally DEFENSIVE: it accepts several plausible field
// names, a KV `settings` store OR a single settings record, and ignores stores
// it does not recognize. Anything it cannot map is omitted (and the importer is
// equally tolerant). DO NOT assume this is exact — adjust the key aliases below
// once the real prototype DB is inspected.
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

/** Default DB name guess when the caller has no better information. */
export const DEFAULT_PROTOTYPE_DB_NAME = 'fs25-planner'

/** Suffix the prototype used for per-species calculator config keys. */
const CALC_CONFIG_SUFFIX = '_calculator_config'

const KNOWN_SPECIES: readonly AnimalSpecies[] = [
  'cow',
  'buffalo',
  'chicken',
  'sheep',
  'goat',
  'pig',
  'horse',
]

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

function toBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1) return true
  if (value === 'false' || value === 0) return false
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
 * Read a store as a flat KV map. Handles two layouts:
 *   - keyPath store: each record is `{ key, value }` (or `{ name, value }`).
 *   - single-record store: one object whose own keys are the settings.
 */
function readKvStore(db: IDBDatabase, storeName: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve({})
      return
    }
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.getAll()
    req.onsuccess = () => {
      const rows = Array.isArray(req.result) ? req.result : []
      const kv: Record<string, unknown> = {}
      for (const row of rows) {
        const rec = asRecord(row)
        const key = rec.key ?? rec.name ?? rec.id
        if (typeof key === 'string' && 'value' in rec) {
          // KV-style record.
          kv[key] = rec.value
        } else {
          // Single-record / object-bag style: fold its own keys in.
          for (const [k, v] of Object.entries(rec)) kv[k] = v
        }
      }
      resolve(kv)
    }
    req.onerror = () => reject(req.error ?? new Error(`Failed to read KV store "${storeName}"`))
  })
}

// --- mappers (raw rows -> documented shape) ----------------------------------

function mapField(row: unknown, index: number): PrototypeField {
  const r = asRecord(row)
  const fieldNumber = toNumber(pick(r, ['fieldNumber', 'number', 'field', 'no'])) ?? index + 1
  const hectares = toNumber(pick(r, ['hectares', 'ha', 'size', 'area'])) ?? 0
  const cropRaw = pick(r, ['crop', 'cropName', 'cultivo', 'cropEs'])
  const crop = typeof cropRaw === 'string' && cropRaw.trim() !== '' ? cropRaw : null
  return {
    fieldNumber,
    hectares,
    crop,
    isSilage: toBool(pick(r, ['isSilage', 'silage', 'ensilaje'])) ?? false,
    yieldBonus: toNumber(pick(r, ['yieldBonus', 'bonus'])) ?? null,
    purchasePrice: toNumber(pick(r, ['purchasePrice', 'price', 'precio'])) ?? null,
  }
}

function mapMachine(row: unknown): PrototypeMachine {
  const r = asRecord(row)
  return {
    name: String(pick(r, ['name', 'nombre']) ?? 'Máquina'),
    workingWidthM: toNumber(pick(r, ['workingWidthM', 'width', 'anchura'])) ?? 0,
    workingSpeedKmh: toNumber(pick(r, ['workingSpeedKmh', 'speed', 'velocidad'])) ?? 0,
  }
}

function mapStable(row: unknown): PrototypeStable {
  const r = asRecord(row)
  return {
    name: String(pick(r, ['name', 'nombre']) ?? 'Establo'),
    species: String(pick(r, ['species', 'especie', 'animal']) ?? ''),
    maxCapacity: toNumber(pick(r, ['maxCapacity', 'capacity', 'capacidad'])) ?? 0,
    currentCount: toNumber(pick(r, ['currentCount', 'count', 'cantidad'])) ?? 0,
    config: asRecord(pick(r, ['config', 'inputs'])),
  }
}

function mapSettings(kv: Record<string, unknown>): PrototypeSettings {
  const settings: PrototypeSettings = {}

  const difficulty = kv.difficulty
  if (typeof difficulty === 'string' && (DIFFICULTIES as readonly string[]).includes(difficulty)) {
    settings.difficulty = difficulty as PrototypeSettings['difficulty']
  }

  const yieldBonus = toNumber(kv.yieldBonus)
  if (yieldBonus !== undefined) settings.yieldBonus = yieldBonus

  const sellPriceType = kv.sellPriceType
  if (
    typeof sellPriceType === 'string' &&
    (SELL_PRICE_TYPES as readonly string[]).includes(sellPriceType)
  ) {
    settings.sellPriceType = sellPriceType as PrototypeSettings['sellPriceType']
  }

  const mapName = kv.mapName ?? kv.map
  if (typeof mapName === 'string' && mapName.trim() !== '') settings.mapName = mapName

  return settings
}

/**
 * Extract per-species calculator configs from the settings KV map. Accepts
 * `<species>_calculator_config` keys (the assumed prototype convention) and also
 * an explicit `animalConfigs` bag if one is present.
 */
function mapAnimalConfigs(
  kv: Record<string, unknown>,
): Record<string, Record<string, unknown>> | undefined {
  const out: Record<string, Record<string, unknown>> = {}

  for (const species of KNOWN_SPECIES) {
    const value = kv[`${species}${CALC_CONFIG_SUFFIX}`]
    if (value && typeof value === 'object') out[species] = asRecord(value)
  }

  // An explicit nested bag, if the prototype stored one.
  const bag = kv.animalConfigs
  if (bag && typeof bag === 'object') {
    for (const [species, cfg] of Object.entries(asRecord(bag))) {
      if (cfg && typeof cfg === 'object') out[species] = asRecord(cfg)
    }
  }

  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Export the prototype data of `dbName` into a {@link PrototypeExport}. Reads ALL
 * object stores defensively; the `fields` and `settings` stores are the core
 * mapping, `machinery`/`stables` and `*_calculator_config` are optional.
 *
 * Throws only when the database cannot be opened; missing stores yield empty
 * sections rather than errors.
 */
export async function exportFromIndexedDb(dbName: string): Promise<PrototypeExport> {
  if (!isIndexedDbAvailable()) {
    throw new Error('IndexedDB no está disponible en este navegador.')
  }

  const db = await openDb(dbName)
  try {
    const [fieldRows, machineRows, stableRows, settingsKv] = await Promise.all([
      readStore(db, 'fields'),
      readStore(db, 'machinery'),
      readStore(db, 'stables'),
      readKvStore(db, 'settings'),
    ])

    const fields = fieldRows.map(mapField)
    const machinery = machineRows.map(mapMachine)
    const stables = stableRows.map(mapStable)
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
