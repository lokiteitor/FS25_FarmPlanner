// features/data-migration/model/types — the DOCUMENTED migration JSON shape
// (`PrototypeExport`) exchanged between the H8.1 exporter and the H8.2 importer,
// the import `ImportReport`, and a lenient zod schema so a bad upload fails
// clearly with field paths instead of throwing deep in the import.
//
// IMPORTANT — the prototype (`planner/`) is NOT in this repo, so its exact
// IndexedDB schema is unknown. This file is the contract we ASSUME and produce;
// the exporter (lib/exportIndexedDb) best-effort maps real prototype stores into
// it, and the importer (lib/importMigration) consumes it tolerantly.
//
// Assumed prototype → PrototypeExport mapping (see lib/exportIndexedDb for the
// IndexedDB details):
//   - global settings (useGlobalSettings: difficulty / yieldBonus /
//     sellPriceType / mapName) → `settings`.
//   - the `fields` store rows → `fields[]` (crop stored as the SPANISH name).
//   - `machinery` / `stables` stores (if present) → those arrays.
//   - `*_calculator_config` keys in the settings KV store → `animalConfigs`
//     keyed by species (cow/buffalo/…).

import { z } from 'zod'

import type { AnimalSpecies, Difficulty, SellPriceType } from '~/entities/catalog'

export type { AnimalSpecies, Difficulty, SellPriceType }

/** Difficulty values accepted in the export (matches the catalog enum). */
export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const

/** Sell-price strategies accepted in the export (matches the catalog enum). */
export const SELL_PRICE_TYPES = ['baseline', 'max_seasonal'] as const

/** Global settings carried by the export, mapped onto the new farm. */
export interface PrototypeSettings {
  difficulty?: Difficulty
  /** Fractional yield bonus (e.g. 0.425 = +42.5%); maps to farm.defaultYieldBonus. */
  yieldBonus?: number
  sellPriceType?: SellPriceType
  mapName?: string
}

/** One field row of the export. `crop` is a Spanish name OR an already-resolved slug. */
export interface PrototypeField {
  fieldNumber: number
  hectares: number
  /** Spanish crop name (prototype) or slug; null/absent = fallow. */
  crop?: string | null
  isSilage?: boolean
  /** Per-field yield-bonus override; null = inherit the farm default. */
  yieldBonus?: number | null
  purchasePrice?: number | null
}

/** One stable row of the export. */
export interface PrototypeStable {
  name: string
  species: string
  maxCapacity: number
  currentCount?: number
  config?: Record<string, unknown>
}

/** One machine row of the export. */
export interface PrototypeMachine {
  name: string
  workingWidthM: number
  workingSpeedKmh: number
}

/**
 * The full migration document. `version`/`exportedAt` make the shape evolvable;
 * everything except `fields` and the two header fields is optional so partial
 * prototypes still import.
 */
export interface PrototypeExport {
  version: number
  exportedAt: string
  settings: PrototypeSettings
  fields: PrototypeField[]
  stables?: PrototypeStable[]
  machinery?: PrototypeMachine[]
  /** species -> raw calculator inputs (kept opaque; the importer upserts them). */
  animalConfigs?: Record<string, Record<string, unknown>>
}

/** A field whose crop name could not be resolved to a catalog slug. */
export interface UnresolvedCrop {
  fieldNumber: number
  name: string
}

/** Outcome of an import run (counts + non-fatal issues). */
export interface ImportReport {
  /** The farm that was created (absent only if farm creation itself failed). */
  farmId?: string
  created: {
    fields: number
    stables: number
    machinery: number
    animalConfigs: number
  }
  /** Fields imported as fallow because their crop name did not resolve. */
  unresolvedCrops: UnresolvedCrop[]
  /** Non-fatal notices (skipped/leaked keys, defaults applied, …). */
  warnings: string[]
  /** Per-item failures that did NOT abort the whole import. */
  errors: string[]
}

// --- zod schema (lenient) ----------------------------------------------------
// Goals: a clearly-broken upload fails up front with a useful path, but a real
// prototype dump (extra keys, loose number-ish strings) still passes. We coerce
// numbers where the prototype may have stored strings, `.passthrough()` unknown
// keys, and keep every optional section optional.

const numberish = z.coerce.number().finite()
const nullableNumberish = z.union([numberish, z.null()]).optional()

const settingsSchema = z
  .object({
    difficulty: z.enum(DIFFICULTIES).optional(),
    yieldBonus: numberish.optional(),
    sellPriceType: z.enum(SELL_PRICE_TYPES).optional(),
    mapName: z.string().optional(),
  })
  .passthrough()

const fieldSchema = z
  .object({
    fieldNumber: z.coerce.number().int(),
    hectares: numberish,
    crop: z.union([z.string(), z.null()]).optional(),
    isSilage: z.coerce.boolean().optional(),
    yieldBonus: nullableNumberish,
    purchasePrice: nullableNumberish,
  })
  .passthrough()

const stableSchema = z
  .object({
    name: z.string(),
    species: z.string(),
    maxCapacity: z.coerce.number().int(),
    currentCount: z.coerce.number().int().optional(),
    config: z.record(z.unknown()).optional(),
  })
  .passthrough()

const machineSchema = z
  .object({
    name: z.string(),
    workingWidthM: numberish,
    workingSpeedKmh: numberish,
  })
  .passthrough()

/**
 * Lenient validator for {@link PrototypeExport}. `settings` defaults to `{}` so a
 * dump that omits the whole section still validates; the importer fills the rest
 * with documented defaults.
 */
export const prototypeExportSchema = z
  .object({
    version: z.coerce.number().default(1),
    exportedAt: z.string().default(() => new Date().toISOString()),
    settings: settingsSchema.default({}),
    fields: z.array(fieldSchema).default([]),
    stables: z.array(stableSchema).optional(),
    machinery: z.array(machineSchema).optional(),
    animalConfigs: z.record(z.record(z.unknown())).optional(),
  })
  .passthrough()

/** The exact type produced by {@link prototypeExportSchema.parse}. */
export type ParsedPrototypeExport = z.infer<typeof prototypeExportSchema>

/**
 * Parse + validate an unknown upload into a {@link PrototypeExport}. Throws a
 * `ZodError` (with field paths) when the document is unusable. The narrowed
 * output is structurally assignable to `PrototypeExport`.
 */
export function parsePrototypeExport(input: unknown): PrototypeExport {
  return prototypeExportSchema.parse(input) as PrototypeExport
}
