// widgets/farm-summary/lib/summary — PURE aggregation of a farm's fields and
// stables into a dashboard summary model. No stores, no network: it receives the
// raw entity rows + the catalog + the farm context and returns plain numbers, so
// it can be unit-tested in isolation (the widget component just wires stores in).
//
// Crop economics reuse shared/lib/engine.cropProjection (ADR-F04): for each field
// that has an assigned crop we resolve the catalog crop by id and project its
// gross income at the farm's difficulty/sellPriceType. Fields with no crop
// (fallow) contribute area but no income. Crops unknown in the current catalog
// (e.g. dropped on a game-version change) are skipped defensively.

import { cropProjection } from '~/shared/lib/engine'
import type { EngineCatalog, FarmContext } from '~/shared/lib/engine'
import type { Field } from '~/entities/field'
import type { Stable } from '~/entities/stable'
import type { Crop } from '~/entities/catalog'

/**
 * One row of the per-crop distribution table.
 *
 * Extends `Record<string, unknown>` so it satisfies the generic constraint of
 * the shared `DataTable` (`Row extends Record<string, unknown>`); without the
 * index signature the slot's `row` would be typed as a bare record, forcing
 * casts in the template (matches the convention used by the other table rows).
 */
export interface CropDistributionRow extends Record<string, unknown> {
  /** Catalog crop slug. */
  slug: string
  /** Spanish crop name. */
  nameEs: string
  /** Number of fields growing this crop (silage and normal counted together). */
  fieldCount: number
  /** Total hectares assigned to this crop. */
  hectares: number
  /** Total harvested liters across those fields (post yield bonus). */
  yieldLiters: number
  /** Total estimated gross income at the farm's difficulty. */
  grossIncome: number
}

/** The full summary model rendered by the widget. */
export interface FarmSummary {
  // ── KPIs ───────────────────────────────────────────────────────────────────
  fieldCount: number
  totalHectares: number
  /** Hectares of fields with an assigned crop. */
  assignedHectares: number
  /** Hectares with no crop (fallow). */
  fallowHectares: number
  stableCount: number
  totalAnimals: number
  /** Sum of gross income across all crop-assigned fields (farm difficulty). */
  totalGrossIncome: number

  // ── Breakdowns ───────────────────────────────────────────────────────────
  /** Per-crop distribution, sorted by descending hectares. */
  cropDistribution: CropDistributionRow[]
  /** Stable head counts grouped by species (sorted by descending count). */
  animalsBySpecies: { species: string; count: number }[]
}

/** Resolve the catalog crop for a field, or undefined (fallow / dropped crop). */
function resolveCrop(field: Field, cropsById: Map<string, Crop>): Crop | undefined {
  if (!field.cropId) return undefined
  return cropsById.get(field.cropId)
}

/**
 * Build the dashboard summary for a farm. `cropById` resolves a field's
 * `cropId` to a catalog crop (the engine works by slug). All economics use
 * `cropProjection` so the dashboard and the per-field calculator agree.
 */
export function buildFarmSummary(
  fields: Field[],
  stables: Stable[],
  catalog: EngineCatalog,
  farm: FarmContext,
  cropById: (id: string) => Crop | undefined,
): FarmSummary {
  // Index crops by id once for O(1) lookups inside the loop.
  const cropsById = new Map<string, Crop>()
  for (const field of fields) {
    if (field.cropId && !cropsById.has(field.cropId)) {
      const crop = cropById(field.cropId)
      if (crop) cropsById.set(field.cropId, crop)
    }
  }

  let totalHectares = 0
  let assignedHectares = 0
  let totalGrossIncome = 0
  const byCrop = new Map<string, CropDistributionRow>()

  for (const field of fields) {
    totalHectares += field.hectares
    const crop = resolveCrop(field, cropsById)
    if (!crop) continue

    assignedHectares += field.hectares
    const projection = cropProjection(
      crop,
      {
        hectares: field.hectares,
        yieldBonus: field.yieldBonus,
        isSilage: field.isSilage,
      },
      farm,
      catalog,
    )
    totalGrossIncome += projection.grossIncome

    const existing = byCrop.get(crop.slug)
    if (existing) {
      existing.fieldCount += 1
      existing.hectares += field.hectares
      existing.yieldLiters += projection.yieldLiters
      existing.grossIncome += projection.grossIncome
    } else {
      byCrop.set(crop.slug, {
        slug: crop.slug,
        nameEs: crop.nameEs,
        fieldCount: 1,
        hectares: field.hectares,
        yieldLiters: projection.yieldLiters,
        grossIncome: projection.grossIncome,
      })
    }
  }

  const cropDistribution = [...byCrop.values()].sort((a, b) => b.hectares - a.hectares)

  // ── Animals by species ──────────────────────────────────────────────────
  let totalAnimals = 0
  const bySpecies = new Map<string, number>()
  for (const stable of stables) {
    totalAnimals += stable.currentCount
    bySpecies.set(stable.species, (bySpecies.get(stable.species) ?? 0) + stable.currentCount)
  }
  const animalsBySpecies = [...bySpecies.entries()]
    .map(([species, count]) => ({ species, count }))
    .sort((a, b) => b.count - a.count)

  return {
    fieldCount: fields.length,
    totalHectares,
    assignedHectares,
    fallowHectares: totalHectares - assignedHectares,
    stableCount: stables.length,
    totalAnimals,
    totalGrossIncome,
    cropDistribution,
    animalsBySpecies,
  }
}
