// features/data-migration/lib/importMigration (H8.2) — import a documented
// {@link PrototypeExport} against the live API: create a farm from the prototype
// settings, then create its fields / stables / machinery and upsert its animal
// calculator configs, resolving Spanish crop names to catalog slugs.
//
// Acceptance (H8): unresolved crops are REPORTED and the field is still created
// (as fallow), and a per-item failure is collected into `report.errors` WITHOUT
// aborting the rest of the import.
//
// FSD: a feature may depend on `entities` (via their public index) and `shared`.
// To stay unit-testable without network, the entity/catalog calls are injected
// through {@link ImportDeps}; the default deps wire the real slice APIs.

import { farmApi } from '~/entities/farm'
import type { Farm } from '~/entities/farm'
import { fieldApi } from '~/entities/field'
import { stableApi } from '~/entities/stable'
import type { AnimalSpecies as StableSpecies } from '~/entities/stable'
import { machineryApi } from '~/entities/machinery'
import { useCatalogStore } from '~/entities/catalog'
import type { Crop } from '~/entities/catalog'
import { put } from '~/shared/api'

import { resolveCropSlug } from './resolveCropSlug'
import type { ResolverCrop } from './resolveCropSlug'
import type { ImportReport, PrototypeExport } from '../model/types'

/** Options for an import run. */
export interface ImportOptions {
  /** Name for the new farm (required; the prototype has no farm name). */
  farmName: string
  /** Pin a specific game version; otherwise the backend's active version is used. */
  gameVersionId?: string
}

/**
 * Injectable collaborators. The defaults wire the real entity APIs + catalog
 * store; tests pass fakes. Each method mirrors the minimal surface the importer
 * needs (not the full entity API), which keeps mocks small.
 */
export interface ImportDeps {
  createFarm: (body: {
    name: string
    gameVersionId?: string
    mapName?: string
    difficulty?: PrototypeExport['settings']['difficulty']
    defaultYieldBonus?: number
    sellPriceType?: PrototypeExport['settings']['sellPriceType']
  }) => Promise<Farm>
  /** Load the crops of the farm's game version for slug resolution. */
  loadCrops: (gameVersionId: string) => Promise<ResolverCrop[]>
  createField: (
    farmId: string,
    body: {
      fieldNumber: number
      hectares: number
      cropId: string | null
      isSilage: boolean
      yieldBonus: number | null
      purchasePrice: number | null
    },
  ) => Promise<unknown>
  /** Resolve a crop slug -> catalog crop id within the loaded catalog. */
  cropIdBySlug: (slug: string) => string | undefined
  createStable: (
    farmId: string,
    body: {
      name: string
      species: StableSpecies
      maxCapacity: number
      currentCount: number
      config: Record<string, unknown>
    },
  ) => Promise<unknown>
  createMachine: (
    farmId: string,
    body: { name: string; workingWidthM: number; workingSpeedKmh: number },
  ) => Promise<unknown>
  upsertAnimalConfig: (
    farmId: string,
    species: StableSpecies,
    inputs: Record<string, unknown>,
  ) => Promise<unknown>
}

/** Defaults applied when the prototype omits a setting (documented in H8). */
const SETTING_DEFAULTS = {
  difficulty: 'normal' as const,
  defaultYieldBonus: 0,
  sellPriceType: 'baseline' as const,
}

/** Species the API accepts; configs/stables for anything else are skipped. */
const VALID_SPECIES: readonly StableSpecies[] = [
  'cow',
  'buffalo',
  'chicken',
  'sheep',
  'goat',
  'pig',
  'horse',
]

/**
 * Keys that belong on the FARM, not on a per-species calculator config. If a
 * prototype leaked them into a config bag we strip them before upserting (the
 * API rejects them — see openapi AnimalConfigs).
 */
const LEAKED_CONFIG_KEYS = ['difficulty', 'sellPriceType'] as const

function isValidSpecies(value: string): value is StableSpecies {
  return (VALID_SPECIES as readonly string[]).includes(value)
}

/** Error message extractor that never throws. */
function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

/**
 * Strip farm-level keys that leaked into a calculator config, returning a new
 * object and the list of keys removed (for a warning).
 */
function stripLeakedKeys(
  inputs: Record<string, unknown>,
): { cleaned: Record<string, unknown>; removed: string[] } {
  const removed = LEAKED_CONFIG_KEYS.filter((key) => key in inputs)
  // Rebuild without the leaked keys (avoids dynamic `delete`).
  const cleaned = Object.fromEntries(
    Object.entries(inputs).filter(([key]) => !(LEAKED_CONFIG_KEYS as readonly string[]).includes(key)),
  )
  return { cleaned, removed }
}

/** Build the default deps from the real entity slice APIs + catalog store. */
export function defaultImportDeps(): ImportDeps {
  const catalog = useCatalogStore()
  return {
    createFarm: (body) => farmApi.create(body),
    loadCrops: async (gameVersionId) => {
      await catalog.load(gameVersionId)
      return (catalog.current?.crops ?? []) as Crop[]
    },
    createField: (farmId, body) => fieldApi.create(farmId, body),
    cropIdBySlug: (slug) => catalog.cropBySlug(slug)?.id,
    createStable: (farmId, body) => stableApi.create(farmId, body),
    createMachine: (farmId, body) => machineryApi.create(farmId, body),
    // PUT /farms/:farmId/animal-configs/:species (openapi AnimalConfigs). The API
    // validates `inputs` (a discriminated union) by the route species. Calling
    // shared/api directly avoids a same-layer feature import (FSD); the body is
    // the cleaned inputs bag (species discriminant ensured by the caller).
    upsertAnimalConfig: (farmId, species, inputs) =>
      put(`/farms/${farmId}/animal-configs/${species}`, inputs),
  }
}

/**
 * Import a prototype export into a fresh farm. Returns an {@link ImportReport};
 * never throws for per-item problems (those go into `report.errors`). Farm
 * creation IS fatal (without a farm there is nothing to import) and rethrows.
 */
export async function importPrototype(
  data: PrototypeExport,
  opts: ImportOptions,
  deps: ImportDeps = defaultImportDeps(),
): Promise<ImportReport> {
  const report: ImportReport = {
    created: { fields: 0, stables: 0, machinery: 0, animalConfigs: 0 },
    unresolvedCrops: [],
    warnings: [],
    errors: [],
  }

  const settings = data.settings ?? {}

  // 1) Create the farm from the prototype settings (with documented defaults).
  const farm = await deps.createFarm({
    name: opts.farmName,
    gameVersionId: opts.gameVersionId,
    mapName: settings.mapName,
    difficulty: settings.difficulty ?? SETTING_DEFAULTS.difficulty,
    defaultYieldBonus: settings.yieldBonus ?? SETTING_DEFAULTS.defaultYieldBonus,
    sellPriceType: settings.sellPriceType ?? SETTING_DEFAULTS.sellPriceType,
  })
  report.farmId = farm.id

  if (settings.difficulty === undefined) {
    report.warnings.push('La dificultad no estaba en el export; se usó "normal".')
  }
  if (settings.sellPriceType === undefined) {
    report.warnings.push('El tipo de precio de venta no estaba en el export; se usó "baseline".')
  }

  // 2) Load the catalog crops of the farm's game version for slug resolution.
  let crops: ResolverCrop[] = []
  try {
    crops = await deps.loadCrops(farm.gameVersionId)
  } catch (err) {
    report.warnings.push(
      `No se pudo cargar el catálogo de cultivos; los campos se importarán sin cultivo (${errMessage(err)}).`,
    )
  }

  // 3) Fields — resolve crop, create even when unresolved (fallow).
  for (const field of data.fields ?? []) {
    try {
      let cropId: string | null = null
      let isSilage = field.isSilage ?? false

      if (field.crop != null && field.crop !== '') {
        const slug = resolveCropSlug(field.crop, crops)
        if (slug) {
          cropId = deps.cropIdBySlug(slug) ?? null
          if (cropId === null) {
            report.warnings.push(
              `Campo ${field.fieldNumber}: el cultivo "${field.crop}" se resolvió a "${slug}" pero no está en el catálogo cargado.`,
            )
          }
        } else {
          // Unresolved crop: report it and create the field as fallow so the
          // import does NOT break (H8 acceptance).
          report.unresolvedCrops.push({ fieldNumber: field.fieldNumber, name: field.crop })
          isSilage = false
        }
      }

      // A field with no resolved crop cannot be silage.
      if (cropId === null) isSilage = false

      await deps.createField(farm.id, {
        fieldNumber: field.fieldNumber,
        hectares: field.hectares,
        cropId,
        isSilage,
        yieldBonus: field.yieldBonus ?? null,
        purchasePrice: field.purchasePrice ?? null,
      })
      report.created.fields += 1
    } catch (err) {
      report.errors.push(`Campo ${field.fieldNumber}: ${errMessage(err)}`)
    }
  }

  // 4) Stables (optional).
  for (const stable of data.stables ?? []) {
    try {
      if (!isValidSpecies(stable.species)) {
        report.warnings.push(
          `Establo "${stable.name}": especie desconocida "${stable.species}"; omitido.`,
        )
        continue
      }
      await deps.createStable(farm.id, {
        name: stable.name,
        species: stable.species,
        maxCapacity: stable.maxCapacity,
        currentCount: stable.currentCount ?? 0,
        config: stable.config ?? {},
      })
      report.created.stables += 1
    } catch (err) {
      report.errors.push(`Establo "${stable.name}": ${errMessage(err)}`)
    }
  }

  // 5) Machinery (optional).
  for (const machine of data.machinery ?? []) {
    try {
      await deps.createMachine(farm.id, {
        name: machine.name,
        workingWidthM: machine.workingWidthM,
        workingSpeedKmh: machine.workingSpeedKmh,
      })
      report.created.machinery += 1
    } catch (err) {
      report.errors.push(`Máquina "${machine.name}": ${errMessage(err)}`)
    }
  }

  // 6) Animal configs (optional) — upsert per species, stripping leaked keys.
  for (const [speciesRaw, rawInputs] of Object.entries(data.animalConfigs ?? {})) {
    try {
      if (!isValidSpecies(speciesRaw)) {
        report.warnings.push(`Config de animal: especie desconocida "${speciesRaw}"; omitida.`)
        continue
      }
      const { cleaned, removed } = stripLeakedKeys(rawInputs ?? {})
      if (removed.length > 0) {
        report.warnings.push(
          `Config de ${speciesRaw}: se eliminaron claves de partida (${removed.join(', ')}).`,
        )
      }
      // Ensure the discriminant matches the route species.
      cleaned.species = speciesRaw
      await deps.upsertAnimalConfig(farm.id, speciesRaw, cleaned)
      report.created.animalConfigs += 1
    } catch (err) {
      report.errors.push(`Config de ${speciesRaw}: ${errMessage(err)}`)
    }
  }

  return report
}
