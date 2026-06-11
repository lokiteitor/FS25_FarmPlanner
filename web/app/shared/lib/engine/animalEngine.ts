// shared/lib/engine/animalEngine — PURE animal projection functions (ADR-F04).
//
// No stores, no network: takes catalog + farm context + inputs as arguments.
// Reconstructed from the documented constants (docs/seeds-catalogo.md §4, §5)
// and standard FS25 herd-projection semantics, NOT ported byte-for-byte from
// the unavailable prototype. Every assumption is documented inline.
//
// ── Core model (per species, see seeds-catalogo §4 monthly_rates) ────────────
//   monthly_rates are L/month PER HEAD; negative = consumption.
//   count                 = inputs.count
//   effectiveYieldBonus   = inputs.yieldBonus ?? farm.defaultYieldBonus
//   productionFactor      = 1 + effectiveYieldBonus
//     · seeds-catalogo gives yield_bonus_scalar = 1.425 alongside
//       default_yield_bonus = 0.425, i.e. the scalar IS (1 + default bonus).
//       We therefore generalize the production factor to (1 + bonus); with the
//       default bonus this reproduces the documented 1.425.
//   feedProductivityFactor (ruminants cow/buffalo) =
//       animalType.feedOptions.productivityFactors[feedType]
//       (tmr/simple 1.0, hay 0.8, grass 0.4; buffalo has no 'simple').
//       Non-ruminants: 1.
//   strawBonusFactor      = provideStraw ? (1 + constants.strawBonus) : 1
//       (+~0.111 to OUTPUT when straw is provided; seeds-catalogo straw_bonus).
//   difficultyScalar      = animalType.difficultyScalars[difficulty]
//       (== income scalar: easy 3.0 / normal 1.8 / hard 1.0).
//
//   For a positive rate r (production):
//     perYearHerd = r * 12 * count * productionFactor * feedProductivityFactor
//                     * strawBonusFactor
//   For a negative rate (consumption), magnitude only, scaled by count
//   (consumption is NOT scaled by yield bonus / productivity / straw — it is the
//   physical feed/straw the herd eats; production bonuses do not change intake).
//
// ── Economics ────────────────────────────────────────────────────────────────
//   Product price per liter:
//     · milk-type (cow/buffalo, product.priceScalar == null):
//         price = product.basePrice * milkScalar,  milkScalar =
//           sellPriceType==='max_seasonal' ? milkPriceScalars.max
//                                          : milkPriceScalars.average
//     · scaled products (eggs 1.25 / wool 1.29 / goat_milk 1.08):
//         price = product.basePrice * product.priceScalar
//   productRevenue = productLitersPerYear * price * difficultyScalar
//     (difficulty scales PRODUCT revenue, like crop income).
//   salesRevenue   = (inputs.sellCount ?? 0) * (animalType.salePrice ?? 0)
//     · NOT scaled by difficulty by default. Rationale (seeds-catalogo §4
//       "Pendiente"): historically cow/pig/horse sale was not difficulty-scaled;
//       sheep/goat sale is new and we keep it consistent (no scaling). Documented
//       and centralized so it can be flipped later.
//   feedCost = bought feed + mineral feed costs where a price datum exists
//     (chicken bought feed via feed_purchase_prices; ruminant TMR mineralFeed
//     via mineral_feed_price). Grown crops have no purchase price -> 0 cost,
//     surfaced as a fieldwork hectares requirement instead.
//   net = productRevenue + salesRevenue - feedCost
//
// ── Fieldwork (feed/straw requirements to sustain the herd) ──────────────────
//   We expose annual liters needed (and hectares of field when a yield is known)
//   per requirement. Hectares use catalog yields:
//     · silage crop  -> silageCrop.yieldPerM2 * chaffFactor * (1 + bonus)
//     · grass/hay    -> constants.grassYieldPerM2 * (1 + bonus)
//     · straw        -> constants.strawYieldPerM2 * (1 + bonus)
//     · grain/root/protein/base feed crops -> crop.yieldPerM2 * (1 + bonus)
//   (1 + bonus) is applied because the field is harvested with the same yield
//   bonus the farm uses for its crops.

import type {
  AnimalInputs,
  AnimalProjectionResult,
  EngineAnimalType,
  EngineCatalog,
  EngineConstants,
  FarmContext,
  FieldworkRequirement,
} from './types'

const MONTHS_PER_YEAR = 12

/** effective yield bonus for an animal config (override ?? farm default). */
export function animalYieldBonus(
  inputBonus: number | null | undefined,
  farm: Pick<FarmContext, 'defaultYieldBonus'>,
): number {
  return inputBonus ?? farm.defaultYieldBonus
}

/**
 * Feed productivity factor for ruminants. Reads
 * productivityFactors[feedType]; defaults to 1 when the species has no
 * productivity factors (non-ruminants) or when no feedType is selected
 * (treated as the neutral tmr/simple path).
 */
export function feedProductivityFactor(
  animalType: EngineAnimalType,
  feedType: AnimalInputs['feedType'],
): number {
  const factors = animalType.feedOptions.productivityFactors
  if (!factors) return 1
  if (!feedType) return 1
  return factors[feedType] ?? 1
}

/** Straw bonus factor: (1 + strawBonus) when provideStraw, else 1. */
export function strawBonusFactor(
  provideStraw: boolean | undefined,
  constants: Pick<EngineConstants, 'strawBonus'>,
): number {
  return provideStraw ? 1 + constants.strawBonus : 1
}

/** Yield-per-m² used to convert a feed requirement into hectares of field. */
function hectaresForLiters(litersPerYear: number, yieldPerM2WithBonus: number): number {
  if (yieldPerM2WithBonus <= 0) return 0
  const m2 = litersPerYear / yieldPerM2WithBonus
  return m2 / 10000
}

/**
 * Project a herd of one species. Returns production, consumption, economics and
 * a fieldwork breakdown. `animalType` MUST match `inputs.species` (caller passes
 * the catalog entry for that species).
 */
export function animalProjection(
  inputs: AnimalInputs,
  farm: FarmContext,
  catalog: EngineCatalog,
): AnimalProjectionResult {
  const animalType = catalog.animalTypes.find((a) => a.species === inputs.species)
  if (!animalType) {
    throw new Error(`animalProjection: unknown species "${inputs.species}" in catalog`)
  }
  return projectFor(animalType, inputs, farm, catalog)
}

/**
 * Same as {@link animalProjection} but with the animal type passed explicitly
 * (skips the catalog lookup). Useful for tests and tight loops.
 */
export function projectFor(
  animalType: EngineAnimalType,
  inputs: AnimalInputs,
  farm: FarmContext,
  catalog: EngineCatalog,
): AnimalProjectionResult {
  const constants = catalog.constants
  const count = inputs.count
  const bonus = animalYieldBonus(inputs.yieldBonus, farm)
  const productionFactor = 1 + bonus
  const feedFactor = feedProductivityFactor(animalType, inputs.feedType)
  const strawFactor = strawBonusFactor(inputs.provideStraw, constants)
  const difficultyScalar = animalType.difficultyScalars[farm.difficulty]

  // ── Production / consumption from monthly_rates ────────────────────────────
  const production: AnimalProjectionResult['production'] = {
    productSlug: animalType.product?.slug ?? null,
    productLitersPerYear: 0,
    productLitersPerMonth: 0,
    byKey: {},
  }
  const consumption: AnimalProjectionResult['consumption'] = { byKey: {} }

  // Output multiplier (production bonuses): yield bonus × feed productivity × straw.
  const outputMultiplier = productionFactor * feedFactor * strawFactor
  const productSlug = animalType.product?.slug ?? null
  // The monthly_rates production key for the sellable product is NOT always the
  // product slug: cow/buffalo/goat all produce under the 'milk' rate key while
  // their product slugs are 'milk'/'buffalo_milk'/'goat_milk' respectively
  // (docs/seeds-catalogo.md §4). eggs/wool match directly. Resolve the rate key
  // so buffalo/goat product revenue isn't silently zeroed.
  const productRateKey = productSlug
    ? productSlug.endsWith('milk')
      ? 'milk'
      : productSlug
    : null

  for (const [key, rate] of Object.entries(animalType.monthlyRates)) {
    if (rate >= 0) {
      const perMonth = rate * count * outputMultiplier
      const perYear = perMonth * MONTHS_PER_YEAR
      production.byKey[key] = { perMonth, perYear }
      // The product line (milk/eggs/wool) drives revenue.
      if (productRateKey && key === productRateKey) {
        production.productLitersPerMonth = perMonth
        production.productLitersPerYear = perYear
      } else if (!productRateKey && (key === 'milk' || key === 'eggs' || key === 'wool')) {
        // Defensive: if product is null but a known product rate exists.
        production.productLitersPerMonth = perMonth
        production.productLitersPerYear = perYear
      }
    } else {
      // Consumption: magnitude, scaled by herd size only (intake is physical).
      const perMonth = Math.abs(rate) * count
      const perYear = perMonth * MONTHS_PER_YEAR
      consumption.byKey[key] = { perMonth, perYear }
    }
  }

  // ── Economics ──────────────────────────────────────────────────────────────
  const productPricePerLiter = computeProductPrice(animalType, farm, constants)
  const productRevenue = production.productLitersPerYear * productPricePerLiter * difficultyScalar

  const sellCount = inputs.sellCount ?? 0
  const salePrice = animalType.salePrice ?? 0
  // Sale price is NOT scaled by difficulty (see header rationale).
  const salesRevenue = sellCount * salePrice

  const fieldwork = computeFieldwork(animalType, inputs, farm, catalog, consumption)
  const feedCost = fieldwork.requirements.reduce((sum, r) => sum + (r.costPerYear ?? 0), 0)

  return {
    species: animalType.species,
    nameEs: animalType.nameEs,
    count,
    effectiveYieldBonus: bonus,
    productionFactor,
    feedProductivityFactor: feedFactor,
    strawBonusFactor: strawFactor,
    difficultyScalar,
    production,
    consumption,
    economics: {
      productRevenue,
      salesRevenue,
      feedCost,
      net: productRevenue + salesRevenue - feedCost,
      productPricePerLiter,
    },
    fieldwork,
  }
}

/**
 * Effective product price per liter.
 *  - milk-type (priceScalar null): basePrice * milk scalar (average | max).
 *  - scaled products: basePrice * priceScalar.
 *  - no product: 0.
 */
export function computeProductPrice(
  animalType: EngineAnimalType,
  farm: Pick<FarmContext, 'sellPriceType'>,
  constants: EngineConstants,
): number {
  const product = animalType.product
  if (!product) return 0
  if (product.priceScalar == null) {
    // Milk-type: use the milk price scalars (cow/buffalo).
    const milkScalar =
      farm.sellPriceType === 'max_seasonal'
        ? constants.milkPriceScalars.max
        : constants.milkPriceScalars.average
    return product.basePrice * milkScalar
  }
  // Scaled product (eggs/wool/goat_milk).
  return product.basePrice * product.priceScalar
}

/**
 * Build the fieldwork / feed-cost breakdown. Per species:
 *  - cow/buffalo (ruminant): TMR ration via feedOptions.tmrRatios (hay, silage,
 *    straw, mineralFeed) applied to the herd's annual food consumption; hay &
 *    grass split via grassHarvests is simplified to a hay requirement; mineral
 *    feed costed via constants.mineralFeedPrice.
 *  - chicken: boughtFeedPercent of food bought (costed via feed_purchase_prices),
 *    the rest grown (grownCrop -> hectares).
 *  - pig/horse: per-component litersPerAnimalMonth * 12 * count, mapped to the
 *    selected crop slug -> hectares. horse also has a hay component.
 *  - sheep/goat: only food consumption -> grass/hay hectares (grassHarvests).
 * Straw consumption (cow/buffalo/pig/horse) -> straw hectares.
 */
function computeFieldwork(
  animalType: EngineAnimalType,
  inputs: AnimalInputs,
  farm: FarmContext,
  catalog: EngineCatalog,
  consumption: AnimalProjectionResult['consumption'],
): AnimalProjectionResult['fieldwork'] {
  const constants = catalog.constants
  const bonus = animalYieldBonus(inputs.yieldBonus, farm)
  const bonusMul = 1 + bonus
  const reqs: FieldworkRequirement[] = []

  const cropYield = (slug: string): number => {
    const crop = catalog.crops.find((c) => c.slug === slug)
    return crop ? crop.yieldPerM2 * bonusMul : 0
  }
  const silageYield = (slug: string): number => {
    const s = catalog.silageCrops.find((sc) => sc.cropSlug === slug)
    return s ? s.yieldPerM2 * s.chaffFactor * bonusMul : 0
  }

  const foodLitersPerYear = consumption.byKey.food?.perYear ?? 0
  const strawLitersPerYear = consumption.byKey.straw?.perYear ?? 0

  // ── Straw requirement (any species that consumes straw) ────────────────────
  if (strawLitersPerYear > 0) {
    const yieldWithBonus = constants.strawYieldPerM2 * bonusMul
    reqs.push({
      key: 'straw',
      slug: 'straw',
      litersPerYear: strawLitersPerYear,
      hectaresNeeded: hectaresForLiters(strawLitersPerYear, yieldWithBonus),
    })
  }

  switch (animalType.species) {
    case 'cow':
    case 'buffalo': {
      // TMR ration: split the annual food into hay/silage/straw/mineral by ratio.
      const ratios = animalType.feedOptions.tmrRatios
      if (ratios && foodLitersPerYear > 0) {
        const silageSlug = inputs.silageCrop ?? animalType.feedOptions.silageCrops?.[0]
        const hayL = foodLitersPerYear * ratios.hay
        const silageL = foodLitersPerYear * ratios.silage
        const tmrStrawL = foodLitersPerYear * ratios.straw
        const mineralL = foodLitersPerYear * ratios.mineralFeed

        reqs.push({
          key: 'hay',
          slug: 'grass',
          litersPerYear: hayL,
          hectaresNeeded: hectaresForLiters(hayL, constants.grassYieldPerM2 * bonusMul),
        })
        if (silageSlug) {
          reqs.push({
            key: `silage:${silageSlug}`,
            slug: silageSlug,
            litersPerYear: silageL,
            hectaresNeeded: hectaresForLiters(silageL, silageYield(silageSlug)),
          })
        }
        reqs.push({
          key: 'tmr-straw',
          slug: 'straw',
          litersPerYear: tmrStrawL,
          hectaresNeeded: hectaresForLiters(tmrStrawL, constants.strawYieldPerM2 * bonusMul),
        })
        reqs.push({
          key: 'mineralFeed',
          slug: 'mineralFeed',
          litersPerYear: mineralL,
          // Mineral feed is bought: cost via mineral_feed_price; no field needed.
          costPerYear: mineralL * constants.mineralFeedPrice,
        })
      }
      break
    }

    case 'chicken': {
      // Split food into bought (% costed) and grown (hectares).
      const pct = Math.min(Math.max(inputs.boughtFeedPercent ?? 0, 0), 100) / 100
      const boughtL = foodLitersPerYear * pct
      const grownL = foodLitersPerYear * (1 - pct)
      if (boughtL > 0) {
        const feedSlug = inputs.boughtFeedType ?? animalType.feedOptions.boughtFeedTypes?.[0]
        const price = feedSlug ? constants.feedPurchasePrices[feedSlug] ?? 0 : 0
        reqs.push({
          key: `feed:${feedSlug ?? 'bought'}`,
          slug: feedSlug,
          litersPerYear: boughtL,
          costPerYear: boughtL * price,
        })
      }
      if (grownL > 0) {
        const grownSlug = inputs.grownCrop ?? animalType.feedOptions.fieldworkCrops?.[0]
        reqs.push({
          key: `grown:${grownSlug ?? 'crop'}`,
          slug: grownSlug,
          litersPerYear: grownL,
          hectaresNeeded: grownSlug
            ? hectaresForLiters(grownL, cropYield(grownSlug))
            : undefined,
        })
      }
      break
    }

    case 'pig':
    case 'horse': {
      // Per-component consumption: litersPerAnimalMonth * 12 * count, mapped to
      // the selected crop slug (or the 'hay' component which has no crops list).
      const components = animalType.feedOptions.components ?? {}
      const selByComponent: Record<string, string | undefined> = {
        base: inputs.baseCrop,
        grain: inputs.grainCrop,
        protein: inputs.proteinCrop,
        root: inputs.rootCrop,
      }
      for (const [name, comp] of Object.entries(components)) {
        const litersPerYear = comp.litersPerAnimalMonth * MONTHS_PER_YEAR * inputs.count
        if (litersPerYear <= 0) continue
        if (name === 'hay') {
          reqs.push({
            key: 'hay',
            slug: 'grass',
            litersPerYear,
            hectaresNeeded: hectaresForLiters(litersPerYear, constants.grassYieldPerM2 * bonusMul),
          })
          continue
        }
        const slug = selByComponent[name] ?? comp.crops?.[0]
        reqs.push({
          key: `feed:${name}${slug ? `:${slug}` : ''}`,
          slug,
          litersPerYear,
          hectaresNeeded: slug ? hectaresForLiters(litersPerYear, cropYield(slug)) : undefined,
        })
      }
      break
    }

    case 'sheep':
    case 'goat': {
      // Only food consumption -> grass/hay hectares (harvested as grass).
      if (foodLitersPerYear > 0) {
        reqs.push({
          key: 'grass',
          slug: 'grass',
          litersPerYear: foodLitersPerYear,
          hectaresNeeded: hectaresForLiters(foodLitersPerYear, constants.grassYieldPerM2 * bonusMul),
        })
      }
      break
    }
  }

  const totalHectaresNeeded = reqs.reduce((sum, r) => sum + (r.hectaresNeeded ?? 0), 0)
  return { requirements: reqs, totalHectaresNeeded }
}
