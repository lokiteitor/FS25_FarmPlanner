// shared/lib/engine/cropEngine — PURE crop projection functions (ADR-F04).
//
// No stores, no network: every function takes the catalog + farm context +
// inputs as arguments. Reconstructed from the documented balance constants
// (docs/seeds-catalogo.md) and standard FS25 projection semantics, NOT ported
// byte-for-byte from the (unavailable) prototype. Every formula assumption is
// documented inline.
//
// ── Formula reference (all from docs/seeds-catalogo.md) ──────────────────────
//   areaM2(ha)            = ha * 10000                  (1 ha = 10 000 m²)
//   effectiveYieldBonus   = field.yieldBonus ?? farm.defaultYieldBonus
//   yieldLiters (normal)  = areaM2 * crop.yieldPerM2 * (1 + bonus)
//   yieldLiters (silage)  = areaM2 * silage.yieldPerM2 * silage.chaffFactor * (1 + bonus)
//   pricePerLiter (normal)= sellPriceType==='max_seasonal'
//                             ? crop.basePrice * crop.maxPriceFactor
//                             : crop.basePrice
//   pricePerLiter (silage)= constants.silagePrice   (global; seasonal factor not
//                             modelled for silage — silage has no maxPriceFactor)
//   grossIncome           = yieldLiters * pricePerLiter * incomeScalar
//   incomeScalar          = constants.incomeDifficultyScalars[difficulty]
//   seedLitersNeeded      = areaM2 * crop.seedRate   (monetary cost OUT OF SCOPE)
//   yieldM3               = yieldLiters / 1000        (1 m³ = 1000 L)
//   yieldTons (normal)    = yieldM3 * crop.weightPerLiter   (PROTO: m³ * weight)
//   yieldTons (silage)    = yieldM3 * constants.silageWeight
//
// NOTE: yieldTons is m³-based (yieldLiters / 1000 * weight), matching the
// prototype's `calculateYieldTons(m3, weight)`. The earlier reconstruction used
// liters * weight (1000× too large); this is now corrected. `yieldLiters` (the
// raw harvest volume the UI shows in the "Rendimiento (L)" column) is unchanged.

import type {
  ByDifficulty,
  CropProjectionInput,
  CropProjectionResult,
  Difficulty,
  EngineCatalog,
  EngineCrop,
  EngineSilageCrop,
  FarmContext,
  SellPriceType,
} from './types'

/** m² for a number of hectares. 1 ha = 10 000 m². */
export function areaM2(hectares: number): number {
  return hectares * 10000
}

/**
 * Effective yield bonus for a field: the field override when provided, else the
 * farm default. `null`/`undefined` both fall back (seeds-catalogo
 * `default_yield_bonus = 0.425`).
 */
export function effectiveYieldBonus(
  fieldYieldBonus: number | null | undefined,
  farm: Pick<FarmContext, 'defaultYieldBonus'>,
): number {
  return fieldYieldBonus ?? farm.defaultYieldBonus
}

/**
 * Baseline price per liter for a normal crop. `max_seasonal` multiplies the
 * base price by the crop's max seasonal factor (seeds-catalogo §2 max_price_factor).
 */
export function cropPricePerLiter(crop: EngineCrop, sellPriceType: SellPriceType): number {
  return sellPriceType === 'max_seasonal' ? crop.basePrice * crop.maxPriceFactor : crop.basePrice
}

/**
 * Liters of seed needed to plant `areaM2` of a crop. seed_rate is L/m²
 * (seeds-catalogo §2). NOTE: the catalog carries NO seed price datum, so the
 * monetary seed cost is intentionally OUT OF SCOPE — we expose only the
 * physical liters and never invent a price.
 */
export function seedLitersNeeded(crop: EngineCrop, area: number): number {
  return area * crop.seedRate
}

/** Liters of seed for a number of hectares (convenience over `seedLitersNeeded`). */
export function seedLitersForHectares(crop: EngineCrop, hectares: number): number {
  return seedLitersNeeded(crop, areaM2(hectares))
}

/**
 * Harvested liters for a NORMAL crop on `areaM2`, after the yield bonus.
 *   yieldLiters = areaM2 * crop.yieldPerM2 * (1 + bonus)
 */
export function cropYieldLiters(crop: EngineCrop, area: number, bonus: number): number {
  return area * crop.yieldPerM2 * (1 + bonus)
}

/**
 * Harvested (chopped) liters for SILAGE on `areaM2`, after the yield bonus.
 * The chopped yield per m² is silage.yieldPerM2 * silage.chaffFactor
 * (seeds-catalogo §3 — silage yield is its own value, multiplied by the chaff
 * factor; this matches the prototype's ANIMAL_FIELDWORK_YIELDS table).
 *   yieldLiters = areaM2 * silage.yieldPerM2 * silage.chaffFactor * (1 + bonus)
 */
export function silageYieldLiters(
  silage: EngineSilageCrop,
  area: number,
  bonus: number,
): number {
  return area * silage.yieldPerM2 * silage.chaffFactor * (1 + bonus)
}

/**
 * Gross income for a given liters/price at each difficulty. easy/normal/hard
 * use constants.incomeDifficultyScalars (easy 3.0 / normal 1.8 / hard 1.0), so
 * by construction easy == 3 * hard and normal == 1.8 * hard.
 */
function grossByDifficulty(
  liters: number,
  pricePerLiter: number,
  scalars: ByDifficulty,
): ByDifficulty {
  const base = liters * pricePerLiter
  return {
    easy: base * scalars.easy,
    normal: base * scalars.normal,
    hard: base * scalars.hard,
  }
}

/**
 * Income-by-difficulty for a NORMAL crop, for the comparison table "ingresos por
 * dificultad". `areaOrHa` is interpreted as hectares (converted to m² here).
 * Uses the baseline price unless `sellPriceType` is supplied as 'max_seasonal'.
 */
export function incomeByDifficulty(
  crop: EngineCrop,
  hectares: number,
  bonus: number,
  constants: EngineCatalog['constants'],
  sellPriceType: SellPriceType = 'baseline',
): ByDifficulty {
  const area = areaM2(hectares)
  const liters = cropYieldLiters(crop, area, bonus)
  const price = cropPricePerLiter(crop, sellPriceType)
  return grossByDifficulty(liters, price, constants.incomeDifficultyScalars)
}

/**
 * Full projection for one crop on one field. Routes through the silage path when
 * `input.isSilage` is set AND a silage crop exists for the slug; otherwise the
 * normal path. Throws if the crop slug is unknown (caller must pass a valid
 * catalog entry).
 */
export function cropProjection(
  crop: EngineCrop,
  input: CropProjectionInput,
  farm: FarmContext,
  catalog: EngineCatalog,
): CropProjectionResult {
  const area = areaM2(input.hectares)
  const bonus = effectiveYieldBonus(input.yieldBonus, farm)
  const incomeScalar = catalog.constants.incomeDifficultyScalars
  const scalarForFarm = incomeScalar[farm.difficulty]

  const silage = input.isSilage
    ? catalog.silageCrops.find((s) => s.cropSlug === crop.slug)
    : undefined
  const isSilage = Boolean(silage)

  let yieldLiters: number
  let pricePerLiter: number
  let weightPerLiter: number
  let basePrice: number
  let maxSeasonalPrice: number

  if (silage) {
    // ── Silage path ─────────────────────────────────────────────────────────
    // Silage has no seasonal price path: baseline and max-seasonal both use the
    // constant silage price (matching the prototype's SILAGE_PRICE / maxMult=1).
    yieldLiters = silageYieldLiters(silage, area, bonus)
    weightPerLiter = catalog.constants.silageWeight
    basePrice = catalog.constants.silagePrice
    maxSeasonalPrice = catalog.constants.silagePrice
    pricePerLiter = catalog.constants.silagePrice
  } else {
    // ── Normal crop path ─────────────────────────────────────────────────────
    yieldLiters = cropYieldLiters(crop, area, bonus)
    weightPerLiter = crop.weightPerLiter
    basePrice = cropPricePerLiter(crop, 'baseline')
    maxSeasonalPrice = cropPricePerLiter(crop, 'max_seasonal')
    pricePerLiter = cropPricePerLiter(crop, farm.sellPriceType)
  }

  const yieldM3 = yieldLiters / 1000
  const yieldTons = yieldM3 * weightPerLiter

  // Income tables: baseline (priceMult=1) and max-seasonal are always provided
  // so the comparison table can render both regardless of farm.sellPriceType.
  const incomeBaseline = grossByDifficulty(yieldLiters, basePrice, incomeScalar)
  const incomeMaxSeasonal = grossByDifficulty(yieldLiters, maxSeasonalPrice, incomeScalar)
  // The table shown for the active farm uses its sellPriceType.
  const incomeByDifficulty =
    farm.sellPriceType === 'max_seasonal' ? incomeMaxSeasonal : incomeBaseline

  return {
    slug: crop.slug,
    nameEs: crop.nameEs,
    areaM2: area,
    effectiveYieldBonus: bonus,
    isSilage,
    yieldLiters,
    yieldM3,
    yieldTons,
    pricePerLiter,
    grossIncome: yieldLiters * pricePerLiter * scalarForFarm,
    incomeByDifficulty,
    incomeBaseline,
    incomeMaxSeasonal,
    seedLitersNeeded: seedLitersNeeded(crop, area),
  }
}

/**
 * Project every crop on the same field area for the comparison table. Returns
 * one `CropProjectionResult` per crop (normal path; silage handled separately by
 * dedicated views). Difficulty is taken from the farm context.
 */
export function compareCrops(
  crops: EngineCrop[],
  hectares: number,
  farm: FarmContext,
  catalog: EngineCatalog,
): CropProjectionResult[] {
  return crops.map((crop) => cropProjection(crop, { hectares }, farm, catalog))
}

/** Re-export the difficulty type narrowing helper for callers/tests. */
export type { Difficulty }
