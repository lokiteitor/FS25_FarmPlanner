// shared/lib/engine/animalEngine — PURE animal projection functions (ADR-F04).
//
// No stores, no network: takes catalog + farm context + inputs as arguments.
// PORTED BYTE-FOR-BYTE (semantically) from THE PROTOTYPE's pure engine
//   …/planner/planner/app/utils/animalCalculations.ts
// but PARAMETRIZED by the EngineCatalog (rates from animalType.monthlyRates,
// productivity/tmr ratios from feedOptions, prices from product base/scalar +
// constants.milkPriceScalars). The parity harness (tests/parity) asserts the
// numbers match the prototype within 1e-6.
//
// ── CRITICAL PROTOTYPE FACTS (reconciled here) ───────────────────────────────
//  1. Animal PRODUCTION quantities are NOT scaled by yieldBonus.
//       cow milk      = count * rate.milk * strawBonusFactor * productivityFactor
//       buffalo milk  = count * rate.milk * (percentProductive/100) * productivityFactor
//       chicken eggs  = count * rate.eggs            (const per head, no factors)
//       sheep wool    = count * rate.wool            (const per head, no factors)
//       goat milk     = count * rate.milk            (const per head, no factors)
//     productivityFactor (cow/buffalo) = feedOptions.productivityFactors[feedType]
//       (tmr/simple 1.0, hay 0.8, grass 0.4; buffalo has no 'simple').
//     strawBonusFactor = provideStraw ? (1 + constants.strawBonus) : 1, applied
//       ONLY to cow milk (NOT buffalo, NOT other species).
//  2. Residues/slurry/manure/straw are count * rate (NO factors, NO bonus) and
//     GATED on provideStraw exactly as the prototype:
//       cow:     slurry always; manure/straw gated.
//       buffalo: slurry = provideStraw ? 2400*n : 5400*n; manure/straw gated.
//       pig:     slurry always; straw/manure gated.
//       horse:   straw/manure gated.
//  3. Product revenue = productLitersYear * unitPrice * difficultyScalar where
//       unitPrice = base * priceScalar (eggs 1.25 / wool 1.29 / goat 1.08) OR
//       base * milkScalar for milk-type (cow/buffalo): milkScalar =
//         sellPriceType==='max_seasonal' ? milkPriceScalars.max : .average.
//     difficultyScalar = animalType.difficultyScalars[difficulty] (easy 3 /
//       normal 1.8 / hard 1).
//  4. Head sales = sellCount * salePrice (cow 3500 / buffalo 3000 / pig 2500 /
//     horse 5000), NOT difficulty-scaled. Sheep/goat sales (salePrice 1000) are
//     a documented v1 EXTENSION: kept in economics.salesRevenue but EXCLUDED
//     from prototype parity (the golden carries no sheep/goat sales).
//  5. Consumption (food) = count * |rate.food| * 12 (cow/buffalo/chicken/sheep/
//     goat). For pig/horse the engine has no aggregate food rate; food is the
//     SUM of the per-component liters (pig: (30+15+12+3) L/head/mo, horse:
//     (95.25+285.75+19.0625) L/head/mo) * 12 * count, surfaced as fieldwork.
//  6. Fieldwork hectares DO use bonusScalar = (1 + bonus) on crop/grass/silage
//     yields, but STRAW hectares use constants.strawYieldPerM2 FLAT (no bonus).
//     Crucial prototype quirk: the straw-BEDDING hectares are only counted in
//     the fieldwork TOTAL for the TMR feed type (cow/buffalo). For
//     Simple/Hay/Grass the prototype's comparable total omits straw bedding.
//
// ── Public shape ─────────────────────────────────────────────────────────────
//   AnimalProjectionResult is unchanged (production.byKey,
//   production.productLitersPerYear, consumption.byKey,
//   economics.{productRevenue,salesRevenue,feedCost,net,productPricePerLiter},
//   fieldwork.{requirements[],totalHectaresNeeded}) so the widgets compile.

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
function hectaresForLiters(litersPerYear: number, yieldPerM2: number): number {
  if (yieldPerM2 <= 0) return 0
  return litersPerYear / yieldPerM2 / 10000
}

/**
 * Effective MONTHLY residue/slurry/manure/straw rate per head, after the
 * prototype's provideStraw gating. Returns the value to use in place of the raw
 * catalog rate for a given (species, key). Keys not listed pass through.
 */
function gatedMonthlyRate(
  species: AnimalInputs['species'],
  key: string,
  rawRate: number,
  provideStraw: boolean,
): number {
  switch (species) {
    case 'cow':
      // slurry always; manure/straw gated.
      if (key === 'manure' || key === 'straw') return provideStraw ? rawRate : 0
      return rawRate
    case 'buffalo':
      // slurry = provideStraw ? 2400 : 5400 ; manure/straw gated.
      if (key === 'slurry') return provideStraw ? rawRate : 5400
      if (key === 'manure' || key === 'straw') return provideStraw ? rawRate : 0
      return rawRate
    case 'pig':
      // slurry always; straw/manure gated.
      if (key === 'straw' || key === 'manure') return provideStraw ? rawRate : 0
      return rawRate
    case 'horse':
      // straw/manure gated.
      if (key === 'straw' || key === 'manure') return provideStraw ? rawRate : 0
      return rawRate
    default:
      return rawRate
  }
}

/**
 * The OUTPUT multiplier applied to the PRODUCT line only (milk/eggs/wool),
 * matching the prototype per species:
 *   cow milk      → productivityFactor * strawBonusFactor
 *   buffalo milk  → productivityFactor * (percentProductive/100)
 *   chicken/sheep/goat → 1 (const per head)
 * Production is NEVER scaled by yield bonus.
 */
function productOutputMultiplier(
  animalType: EngineAnimalType,
  inputs: AnimalInputs,
  constants: EngineConstants,
): number {
  switch (animalType.species) {
    case 'cow': {
      const prod = feedProductivityFactor(animalType, inputs.feedType)
      const straw = strawBonusFactor(inputs.provideStraw, constants)
      return prod * straw
    }
    case 'buffalo': {
      const prod = feedProductivityFactor(animalType, inputs.feedType)
      const pct = (inputs.percentProductive ?? 100) / 100
      return prod * pct
    }
    default:
      return 1
  }
}

/**
 * Project a herd of one species. Returns production, consumption, economics and
 * a fieldwork breakdown.
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
  const provideStraw = inputs.provideStraw === true
  const bonus = animalYieldBonus(inputs.yieldBonus, farm)
  const productionFactor = 1 + bonus // reported only; production is NOT scaled by it
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

  const productSlug = animalType.product?.slug ?? null
  // The monthly_rates production key for the sellable product is NOT always the
  // product slug: cow/buffalo/goat all produce under the 'milk' rate key while
  // their product slugs are 'milk'/'buffalo_milk'/'goat_milk' (the catalog
  // monthlyRates key is 'milk' for all three). eggs/wool match directly.
  const productRateKey = productSlug
    ? productSlug.endsWith('milk')
      ? 'milk'
      : productSlug
    : null

  // The PRODUCT output multiplier (per-species; never the yield bonus).
  const prodMultiplier = productOutputMultiplier(animalType, inputs, constants)

  for (const [key, rawRate] of Object.entries(animalType.monthlyRates)) {
    if (rawRate >= 0) {
      const isProduct =
        (productRateKey && key === productRateKey) ||
        (!productRateKey && (key === 'milk' || key === 'eggs' || key === 'wool'))
      if (isProduct) {
        // PRODUCT line: count * rate * per-species multiplier (NO yield bonus).
        const perMonth = rawRate * count * prodMultiplier
        const perYear = perMonth * MONTHS_PER_YEAR
        production.byKey[key] = { perMonth, perYear }
        production.productLitersPerMonth = perMonth
        production.productLitersPerYear = perYear
      } else {
        // Residue (slurry/manure): count * GATED rate, NO factors, NO bonus.
        const rate = gatedMonthlyRate(animalType.species, key, rawRate, provideStraw)
        const perMonth = rate * count
        const perYear = perMonth * MONTHS_PER_YEAR
        production.byKey[key] = { perMonth, perYear }
      }
    } else {
      // Consumption: magnitude of the GATED rate, scaled by herd size only.
      const rate = gatedMonthlyRate(animalType.species, key, rawRate, provideStraw)
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
  // Sale price is NOT scaled by difficulty (prototype: cow/buffalo/pig/horse
  // sales are flat). Sheep/goat sales are a v1 extension (excluded from parity).
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
 * Build the fieldwork / feed-cost breakdown, ported from the prototype per
 * species. Hectares use bonus on crop/grass/silage yields; straw hectares use
 * constants.strawYieldPerM2 FLAT (no bonus). The straw-BEDDING hectares are only
 * counted in the total for the TMR feed type (cow/buffalo) — a prototype quirk.
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
  const grassYield = constants.grassYieldPerM2 * bonusMul
  const strawYield = constants.strawYieldPerM2 // FLAT, no bonus
  const grassHarvests = inputs.grassHarvests ?? 1
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

  switch (animalType.species) {
    case 'cow':
    case 'buffalo': {
      const feedType = inputs.feedType ?? 'tmr'
      const ratios = animalType.feedOptions.tmrRatios
      const silageSlug = inputs.silageCrop ?? animalType.feedOptions.silageCrops?.[0]

      if (feedType === 'tmr' && ratios && foodLitersPerYear > 0) {
        // TMR ration split: hay/silage/straw via ratios; mineral feed bought.
        const hayL = foodLitersPerYear * ratios.hay
        const silageL = foodLitersPerYear * ratios.silage
        const tmrStrawL = foodLitersPerYear * ratios.straw
        const mineralL = foodLitersPerYear * ratios.mineralFeed

        reqs.push({
          key: 'hay',
          slug: 'grass',
          litersPerYear: hayL,
          hectaresNeeded: hectaresForLiters(hayL, grassYield * grassHarvests),
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
          hectaresNeeded: hectaresForLiters(tmrStrawL, strawYield),
        })
        reqs.push({
          key: 'mineralFeed',
          slug: 'mineralFeed',
          litersPerYear: mineralL,
          // Mineral feed is bought: cost via mineral_feed_price; no field needed.
          costPerYear: mineralL * constants.mineralFeedPrice,
        })
        // Straw bedding hectares are ONLY counted (in the total) for TMR.
        if (strawLitersPerYear > 0) {
          reqs.push({
            key: 'straw-bedding',
            slug: 'straw',
            litersPerYear: strawLitersPerYear,
            hectaresNeeded: hectaresForLiters(strawLitersPerYear, strawYield),
          })
        }
      } else if (feedType === 'simple' && foodLitersPerYear > 0) {
        // Simple feed: grass + silage (NO straw bedding counted in the total).
        reqs.push({
          key: 'grass',
          slug: 'grass',
          litersPerYear: foodLitersPerYear,
          hectaresNeeded: hectaresForLiters(foodLitersPerYear, grassYield * grassHarvests),
        })
        if (silageSlug) {
          reqs.push({
            key: `silage:${silageSlug}`,
            slug: silageSlug,
            litersPerYear: foodLitersPerYear,
            hectaresNeeded: hectaresForLiters(foodLitersPerYear, silageYield(silageSlug)),
          })
        }
      } else if ((feedType === 'hay' || feedType === 'grass') && foodLitersPerYear > 0) {
        // Direct hay/grass: a single grass requirement (NO straw bedding).
        reqs.push({
          key: feedType === 'hay' ? 'hay' : 'grass',
          slug: 'grass',
          litersPerYear: foodLitersPerYear,
          hectaresNeeded: hectaresForLiters(foodLitersPerYear, grassYield * grassHarvests),
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
          // Hay → grass yield × grassHarvests (prototype horse hay path).
          reqs.push({
            key: 'hay',
            slug: 'grass',
            litersPerYear,
            hectaresNeeded: hectaresForLiters(litersPerYear, grassYield * grassHarvests),
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
      // Only food consumption → grass hectares (grassYield × grassHarvests).
      if (foodLitersPerYear > 0) {
        reqs.push({
          key: 'grass',
          slug: 'grass',
          litersPerYear: foodLitersPerYear,
          hectaresNeeded: hectaresForLiters(foodLitersPerYear, grassYield * grassHarvests),
        })
      }
      break
    }
  }

  const totalHectaresNeeded = reqs.reduce((sum, r) => sum + (r.hectaresNeeded ?? 0), 0)
  return { requirements: reqs, totalHectaresNeeded }
}
