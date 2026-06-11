/**
 * generateGolden — DEV TOOL (run manually, NOT part of the test suite).
 *
 * Generates `tests/parity/golden.json`: golden reference values extracted
 * directly from THE PROTOTYPE's pure calculation engine. The web engine
 * (app/shared/lib/engine) is then asserted against these values by
 * `tests/parity/parity.test.ts`.
 *
 * REQUIREMENTS
 * ────────────
 * This script imports the prototype calc functions by ABSOLUTE path:
 *   /home/ddelgado/git/lab/FS25_FarmPlanner/planner/planner/app/utils/*
 * The prototype MUST be present at that path (read-only reference). It is a
 * developer tool, not run in CI; the committed `golden.json` is the artifact
 * the test suite consumes.
 *
 * RUN
 * ───
 *   npx tsx tests/parity/generateGolden.ts
 *
 * Each emitted case is { category, label, contractInputs, farmContext, expected }:
 *  - contractInputs : inputs in OUR engine/contract encoding (lowercase slugs,
 *    lowercase feedType, species, etc.). The test maps these THROUGH the web
 *    engine.
 *  - farmContext    : { difficulty, defaultYieldBonus, sellPriceType } in our
 *    contract encoding.
 *  - expected       : the canonical comparable numbers, extracted from the
 *    PROTOTYPE result. The contract→proto encoding map used to call the
 *    prototype lives in this file (see toProto* helpers below).
 *
 * CONTRACT → PROTO ENCODING MAP (documented + applied here)
 * ─────────────────────────────────────────────────────────
 *   difficulty:     easy→'Easy'      normal→'Normal'   hard→'Hard'
 *   sellPriceType:  baseline→'Baseline'   max_seasonal→'MaxSeasonal'
 *   feedType:       tmr→'TMR'  simple→'Simple'  hay→'Hay'  grass→'Grass'
 *   silage slug:    corn→'Corn' barley→'Barley' wheat→'Wheat' sorghum→'Sorghum'
 *                   sunflower→'Sunflower' oat→'Oat' canola→'Canola' soybean→'Soybean'
 *   chicken bought feed:  oat→'Oat'   wheat→'Wheat'
 *   chicken grown crop:   wheat→'Wheat' barley→'Barley' sorghum→'Sorghum'
 *   pig base crop:        corn→'Corn'  sorghum→'Sorghum'
 *   pig grain crop:       wheat→'Wheat' barley→'Barley'
 *   pig protein crop:     soybean→'Soy' canola→'Canola' sunflower→'Sunflower'
 *   pig/horse root crop:  potato→'Potato' sugarbeet→'Sugarbeet' redbeet→'Redbeet'
 *                         parsnip→'Parsnip' carrot→'Carrot'
 *   horse base crop:      oat→'Oat'  sorghum→'Sorghum'
 *   buffalo percentProductive: always 100 (contract has no such field).
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// ── Prototype pure engine (read-only reference, absolute path) ───────────────
import { calculateFields } from '/home/ddelgado/git/lab/FS25_FarmPlanner/planner/planner/app/utils/cropCalculations.ts'
import {
  calculateCows,
  calculateChickens,
  calculateSheep,
  calculateGoats,
  calculatePigs,
  calculateHorses,
  calculateBuffaloes,
} from '/home/ddelgado/git/lab/FS25_FarmPlanner/planner/planner/app/utils/animalCalculations.ts'

// ── Contract encodings (our side) ────────────────────────────────────────────
type Difficulty = 'easy' | 'normal' | 'hard'
type SellPriceType = 'baseline' | 'max_seasonal'
type FeedType = 'tmr' | 'simple' | 'hay' | 'grass'

interface FarmContext {
  difficulty: Difficulty
  defaultYieldBonus: number
  sellPriceType: SellPriceType
}

interface GoldenCase {
  category: string
  label: string
  contractInputs: Record<string, unknown>
  farmContext: FarmContext
  expected: Record<string, unknown>
}

// ── Contract → Proto encoding helpers ────────────────────────────────────────
const toProtoDifficulty = (d: Difficulty): 'Easy' | 'Normal' | 'Hard' =>
  d === 'easy' ? 'Easy' : d === 'normal' ? 'Normal' : 'Hard'

const toProtoSellPrice = (s: SellPriceType): 'Baseline' | 'MaxSeasonal' =>
  s === 'max_seasonal' ? 'MaxSeasonal' : 'Baseline'

const toProtoFeedType = (f: FeedType): 'TMR' | 'Simple' | 'Hay' | 'Grass' =>
  f === 'tmr' ? 'TMR' : f === 'simple' ? 'Simple' : f === 'hay' ? 'Hay' : 'Grass'

// Silage / fieldwork crop slugs → the proto's accepted PascalCase keys.
const toProtoSilage = (slug: string): string => {
  const map: Record<string, string> = {
    corn: 'Corn',
    barley: 'Barley',
    wheat: 'Wheat',
    sorghum: 'Sorghum',
    sunflower: 'Sunflower',
    oat: 'Oat',
    canola: 'Canola',
    soybean: 'Soybean',
  }
  return map[slug] ?? 'Corn'
}

const toProtoChickenGrown = (slug: string): 'Barley' | 'Wheat' | 'Sorghum' => {
  const map: Record<string, 'Barley' | 'Wheat' | 'Sorghum'> = {
    barley: 'Barley',
    wheat: 'Wheat',
    sorghum: 'Sorghum',
  }
  return map[slug] ?? 'Wheat'
}

const toProtoChickenBought = (slug: string): 'Oat' | 'Wheat' =>
  slug === 'oat' ? 'Oat' : 'Wheat'

const toProtoPigBase = (slug: string): 'Corn' | 'Sorghum' =>
  slug === 'sorghum' ? 'Sorghum' : 'Corn'
const toProtoPigGrain = (slug: string): 'Wheat' | 'Barley' =>
  slug === 'barley' ? 'Barley' : 'Wheat'
const toProtoPigProtein = (slug: string): 'Soy' | 'Canola' | 'Sunflower' => {
  const map: Record<string, 'Soy' | 'Canola' | 'Sunflower'> = {
    soybean: 'Soy',
    canola: 'Canola',
    sunflower: 'Sunflower',
  }
  return map[slug] ?? 'Soy'
}
const toProtoRoot = (
  slug: string,
): 'Potato' | 'Sugarbeet' | 'Redbeet' | 'Parsnip' | 'Carrot' => {
  const map: Record<string, 'Potato' | 'Sugarbeet' | 'Redbeet' | 'Parsnip' | 'Carrot'> = {
    potato: 'Potato',
    sugarbeet: 'Sugarbeet',
    redbeet: 'Redbeet',
    parsnip: 'Parsnip',
    carrot: 'Carrot',
  }
  return map[slug] ?? 'Potato'
}
const toProtoHorseBase = (slug: string): 'Oat' | 'Sorghum' =>
  slug === 'sorghum' ? 'Sorghum' : 'Oat'

// Map a crop slug to the prototype crop display name accepted by findCrop().
// The prototype's cropTranslationMap accepts these English keys.
const cropSlugToProtoName: Record<string, string> = {
  wheat: 'wheat',
  corn: 'corn',
  poplar: 'poplar',
  onion: 'onion',
  grass: 'grass',
  barley: 'barley',
  oat: 'oat',
  soybean: 'soybean',
  potato: 'potato',
}
// Silage field crop slug → proto silage display name (findSilageCrop()).
const silageSlugToProtoName: Record<string, string> = {
  poplar: 'poplar',
  grass: 'grass',
  corn: 'corn',
  wheat: 'wheat',
  barley: 'barley',
  oat: 'oat',
  soybean: 'soybean',
  canola: 'canola',
  sorghum: 'sorghum',
  sunflower: 'sunflower',
}

// ── Builders ─────────────────────────────────────────────────────────────────
const cases: GoldenCase[] = []
const push = (c: GoldenCase) => cases.push(c)

// 1) CROPS ────────────────────────────────────────────────────────────────────
// expected per single field:
//   { yieldM3, yieldTons, incomeBaseline:{easy,normal,hard}, incomeMaxSeasonal:{...} }
// Proto calculateFields([field], bonus) → result.fields[0].
type CropSpec = { slug: string; isSilage: boolean; label: string }
const cropSpecs: CropSpec[] = [
  { slug: 'wheat', isSilage: false, label: 'wheat normal' },
  { slug: 'corn', isSilage: false, label: 'corn normal' },
  { slug: 'poplar', isSilage: false, label: 'poplar normal' },
  { slug: 'poplar', isSilage: true, label: 'poplar silage' },
  { slug: 'onion', isSilage: false, label: 'onion normal' },
  { slug: 'grass', isSilage: true, label: 'grass silage' },
]
const cropHectares = 12.5
const cropBonuses = [0, 0.425]

for (const spec of cropSpecs) {
  for (const bonus of cropBonuses) {
    const protoCropName = spec.isSilage
      ? silageSlugToProtoName[spec.slug]
      : cropSlugToProtoName[spec.slug]
    const res = calculateFields(
      [{ name: 'F', hectares: cropHectares, cropName: protoCropName, isSilage: spec.isSilage }],
      bonus,
    )
    const f = res.fields[0]!
    // farm context difficulty/sellPriceType do not change the per-field
    // baseline/maxSeasonal breakdown (the proto emits both tables); we tag the
    // case farm as normal/baseline because the comparable carries all 6 numbers.
    push({
      category: 'crop',
      label: `${spec.label} bonus=${bonus}`,
      contractInputs: {
        slug: spec.slug,
        hectares: cropHectares,
        yieldBonus: bonus,
        isSilage: spec.isSilage,
      },
      farmContext: { difficulty: 'normal', defaultYieldBonus: bonus, sellPriceType: 'baseline' },
      expected: {
        yieldM3: f.yieldM3,
        yieldTons: f.yieldTons,
        incomeBaseline: {
          easy: f.income.baseline.easy,
          normal: f.income.baseline.normal,
          hard: f.income.baseline.hard,
        },
        incomeMaxSeasonal: {
          easy: f.income.maxSeasonal.easy,
          normal: f.income.maxSeasonal.normal,
          hard: f.income.maxSeasonal.hard,
        },
      },
    })
  }
}

// 2) COWS ───────────────────────────────────────────────────────────────────
// expected: { milkLitersYear, milkRevenueYear, slurryYear, manureYear, strawYear,
//             foodYear, salesYear, mineralCostYear, tmrTotalHectares,
//             fieldworkHectares }
//   tmrTotalHectares: proto fieldwork.tmr.totalTmrHectares (TMR only).
//   fieldworkHectares: simple grass + silage when feedType==='Simple', else the
//     simple grass requirement (Grass/Hay), so the engine has a single comparable.
// Prune to ~12 representative cow cases.
const cowCount = 45
const cowSilage = 'corn'
const cowSell = 5
const cowGrassHarvests = 2
type CowSpec = { feedType: FeedType; provideStraw: boolean; difficulty: Difficulty; sellPriceType: SellPriceType }
const cowSpecs: CowSpec[] = [
  { feedType: 'tmr', provideStraw: true, difficulty: 'normal', sellPriceType: 'baseline' },
  { feedType: 'tmr', provideStraw: false, difficulty: 'normal', sellPriceType: 'baseline' },
  { feedType: 'tmr', provideStraw: true, difficulty: 'easy', sellPriceType: 'max_seasonal' },
  { feedType: 'tmr', provideStraw: true, difficulty: 'hard', sellPriceType: 'baseline' },
  { feedType: 'simple', provideStraw: true, difficulty: 'normal', sellPriceType: 'baseline' },
  { feedType: 'simple', provideStraw: false, difficulty: 'easy', sellPriceType: 'baseline' },
  { feedType: 'simple', provideStraw: true, difficulty: 'normal', sellPriceType: 'max_seasonal' },
  { feedType: 'hay', provideStraw: true, difficulty: 'normal', sellPriceType: 'baseline' },
  { feedType: 'hay', provideStraw: false, difficulty: 'hard', sellPriceType: 'max_seasonal' },
  { feedType: 'grass', provideStraw: true, difficulty: 'easy', sellPriceType: 'baseline' },
  { feedType: 'grass', provideStraw: false, difficulty: 'normal', sellPriceType: 'baseline' },
  { feedType: 'grass', provideStraw: true, difficulty: 'hard', sellPriceType: 'max_seasonal' },
]
const cowBonus = 0.425
for (const s of cowSpecs) {
  const r = calculateCows({
    numCows: cowCount,
    yieldBonus: cowBonus,
    grassHarvests: cowGrassHarvests,
    provideStraw: s.provideStraw,
    breed: 'Holstein',
    feedType: toProtoFeedType(s.feedType),
    difficulty: toProtoDifficulty(s.difficulty),
    sellPriceType: toProtoSellPrice(s.sellPriceType),
    sellCount: cowSell,
    silageCrop: toProtoSilage(cowSilage),
  })
  const fieldworkHectares =
    s.feedType === 'tmr'
      ? r.fieldwork.tmr.totalTmrHectares
      : s.feedType === 'simple'
        ? r.fieldwork.simple.grass + r.fieldwork.simple.silage
        : r.fieldwork.simple.grass
  push({
    category: 'cow',
    label: `cow ${s.feedType} straw=${s.provideStraw} ${s.difficulty} ${s.sellPriceType}`,
    contractInputs: {
      species: 'cow',
      count: cowCount,
      yieldBonus: cowBonus,
      feedType: s.feedType,
      provideStraw: s.provideStraw,
      grassHarvests: cowGrassHarvests,
      silageCrop: cowSilage,
      sellCount: cowSell,
      breed: 'holstein',
    },
    farmContext: { difficulty: s.difficulty, defaultYieldBonus: cowBonus, sellPriceType: s.sellPriceType },
    expected: {
      milkLitersYear: r.production.milk.yearly,
      milkRevenueYear: r.production.milk.revenueYearly,
      slurryYear: r.production.slurry.yearly,
      manureYear: r.production.manure.yearly,
      strawYear: r.production.straw.yearly,
      foodYear: r.production.food.yearly,
      salesYear: r.sales.beefSales,
      mineralCostYear: r.tmrUsage.mineralCostYearly,
      tmrTotalHectares: s.feedType === 'tmr' ? r.fieldwork.tmr.totalTmrHectares : 0,
      fieldworkHectares,
    },
  })
}

// 3) BUFFALOES ──────────────────────────────────────────────────────────────
// Same comparable schema as cow. feedType ∈ {tmr,hay,grass}; percentProductive 100.
const buffaloCount = 45
type BuffSpec = { feedType: 'tmr' | 'hay' | 'grass'; provideStraw: boolean; difficulty: Difficulty; sellPriceType: SellPriceType }
const buffSpecs: BuffSpec[] = [
  { feedType: 'tmr', provideStraw: true, difficulty: 'normal', sellPriceType: 'baseline' },
  { feedType: 'tmr', provideStraw: false, difficulty: 'easy', sellPriceType: 'max_seasonal' },
  { feedType: 'tmr', provideStraw: true, difficulty: 'hard', sellPriceType: 'baseline' },
  { feedType: 'hay', provideStraw: true, difficulty: 'normal', sellPriceType: 'baseline' },
  { feedType: 'hay', provideStraw: false, difficulty: 'normal', sellPriceType: 'max_seasonal' },
  { feedType: 'grass', provideStraw: true, difficulty: 'easy', sellPriceType: 'baseline' },
  { feedType: 'grass', provideStraw: false, difficulty: 'hard', sellPriceType: 'baseline' },
]
for (const s of buffSpecs) {
  const r = calculateBuffaloes({
    numBuffaloes: buffaloCount,
    yieldBonus: cowBonus,
    grassHarvests: cowGrassHarvests,
    provideStraw: s.provideStraw,
    feedType: toProtoFeedType(s.feedType) as 'TMR' | 'Hay' | 'Grass',
    difficulty: toProtoDifficulty(s.difficulty),
    sellPriceType: toProtoSellPrice(s.sellPriceType),
    sellCount: cowSell,
    percentProductive: 100,
    silageCrop: toProtoSilage(cowSilage),
  })
  const fieldworkHectares =
    s.feedType === 'tmr'
      ? r.fieldwork.tmr.totalTmrHectares
      : s.feedType === 'grass'
        ? r.fieldwork.simple.grass
        : // hay: proto puts the direct-hay requirement in tmr.hayMix
          r.fieldwork.tmr.hayMix
  push({
    category: 'buffalo',
    label: `buffalo ${s.feedType} straw=${s.provideStraw} ${s.difficulty} ${s.sellPriceType}`,
    contractInputs: {
      species: 'buffalo',
      count: buffaloCount,
      yieldBonus: cowBonus,
      feedType: s.feedType,
      provideStraw: s.provideStraw,
      grassHarvests: cowGrassHarvests,
      silageCrop: cowSilage,
      sellCount: cowSell,
    },
    farmContext: { difficulty: s.difficulty, defaultYieldBonus: cowBonus, sellPriceType: s.sellPriceType },
    expected: {
      milkLitersYear: r.production.milk.yearly,
      milkRevenueYear: r.production.milk.revenueYearly,
      slurryYear: r.production.slurry.yearly,
      manureYear: r.production.manure.yearly,
      strawYear: r.production.straw.yearly,
      foodYear: r.production.food.yearly,
      salesYear: r.sales.buffaloSales,
      mineralCostYear: r.tmrUsage.mineralCostYearly,
      tmrTotalHectares: s.feedType === 'tmr' ? r.fieldwork.tmr.totalTmrHectares : 0,
      fieldworkHectares,
    },
  })
}

// 4) CHICKENS ────────────────────────────────────────────────────────────────
// expected: { eggsYear, revenueYear, feedTotalYear, feedBought, feedGrown,
//             feedCostYear, fieldworkHectares, netYear }
const chickenCount = 100
type ChxSpec = { boughtPct: number; boughtType: 'oat' | 'wheat'; difficulty: Difficulty }
const chxSpecs: ChxSpec[] = [
  { boughtPct: 0, boughtType: 'oat', difficulty: 'normal' },
  { boughtPct: 50, boughtType: 'oat', difficulty: 'normal' },
  { boughtPct: 100, boughtType: 'oat', difficulty: 'normal' },
  { boughtPct: 0, boughtType: 'wheat', difficulty: 'easy' },
  { boughtPct: 50, boughtType: 'wheat', difficulty: 'easy' },
  { boughtPct: 100, boughtType: 'wheat', difficulty: 'easy' },
]
const chickenGrown = 'wheat'
for (const s of chxSpecs) {
  const r = calculateChickens({
    numChx: chickenCount,
    yieldBonus: cowBonus,
    difficulty: toProtoDifficulty(s.difficulty),
    sellPriceType: 'Baseline',
    feedBoughtPercent: s.boughtPct,
    feedType: toProtoChickenBought(s.boughtType),
    fieldworkCrop: toProtoChickenGrown(chickenGrown),
  })
  push({
    category: 'chicken',
    label: `chicken bought=${s.boughtPct}% ${s.boughtType} ${s.difficulty}`,
    contractInputs: {
      species: 'chicken',
      count: chickenCount,
      yieldBonus: cowBonus,
      boughtFeedPercent: s.boughtPct,
      boughtFeedType: s.boughtType,
      grownCrop: chickenGrown,
    },
    farmContext: { difficulty: s.difficulty, defaultYieldBonus: cowBonus, sellPriceType: 'baseline' },
    expected: {
      eggsYear: r.eggs.yearly,
      revenueYear: r.eggs.revenueYearly,
      feedTotalYear: r.feed.total,
      feedBought: r.feed.bought,
      feedGrown: r.feed.grown,
      feedCostYear: r.feed.costYearly,
      fieldworkHectares: r.fieldwork.hectares,
      netYear: r.net.yearly,
    },
  })
}

// 5) SHEEP ───────────────────────────────────────────────────────────────────
// expected: { woolLitersYear, revenueYear, feedYear, fieldworkHectares }
const sheepCount = 50
for (const difficulty of ['normal', 'easy'] as Difficulty[]) {
  const r = calculateSheep({
    numSheep: sheepCount,
    yieldBonus: cowBonus,
    grassHarvests: cowGrassHarvests,
    difficulty: toProtoDifficulty(difficulty),
    sellPriceType: 'Baseline',
  })
  push({
    category: 'sheep',
    label: `sheep ${difficulty}`,
    contractInputs: { species: 'sheep', count: sheepCount, yieldBonus: cowBonus, grassHarvests: cowGrassHarvests },
    farmContext: { difficulty, defaultYieldBonus: cowBonus, sellPriceType: 'baseline' },
    expected: {
      woolLitersYear: r.wool.yearly,
      revenueYear: r.wool.revenueYearly,
      feedYear: r.feed.totalYearly,
      fieldworkHectares: r.fieldwork.totalHectares,
    },
  })
}

// 6) GOATS ───────────────────────────────────────────────────────────────────
// expected: { milkLitersYear, revenueYear, feedYear, fieldworkHectares }
const goatCount = 30
for (const difficulty of ['normal', 'easy'] as Difficulty[]) {
  const r = calculateGoats({
    numGoats: goatCount,
    yieldBonus: cowBonus,
    grassHarvests: cowGrassHarvests,
    difficulty: toProtoDifficulty(difficulty),
    sellPriceType: 'Baseline',
  })
  push({
    category: 'goat',
    label: `goat ${difficulty}`,
    contractInputs: { species: 'goat', count: goatCount, yieldBonus: cowBonus, grassHarvests: cowGrassHarvests },
    farmContext: { difficulty, defaultYieldBonus: cowBonus, sellPriceType: 'baseline' },
    expected: {
      milkLitersYear: r.goatMilk.yearly,
      revenueYear: r.goatMilk.revenueYearly,
      feedYear: r.feed.totalYearly,
      fieldworkHectares: r.fieldwork.totalHectares,
    },
  })
}

// 7) PIGS ────────────────────────────────────────────────────────────────────
// expected: { slurryYear, strawYear, manureYear, feedTotalYear, salesYear, totalHectares }
const pigCount = 80
const pigSell = 10
for (const provideStraw of [true, false]) {
  const r = calculatePigs({
    numPigs: pigCount,
    yieldBonus: cowBonus,
    difficulty: 'Normal',
    sellPriceType: 'Baseline',
    sellCount: pigSell,
    provideStraw,
    baseCrop: toProtoPigBase('corn'),
    grainCrop: toProtoPigGrain('wheat'),
    proteinCrop: toProtoPigProtein('soybean'),
    rootCrop: toProtoRoot('potato'),
  })
  push({
    category: 'pig',
    label: `pig straw=${provideStraw}`,
    contractInputs: {
      species: 'pig',
      count: pigCount,
      yieldBonus: cowBonus,
      provideStraw,
      baseCrop: 'corn',
      grainCrop: 'wheat',
      proteinCrop: 'soybean',
      rootCrop: 'potato',
      sellCount: pigSell,
    },
    farmContext: { difficulty: 'normal', defaultYieldBonus: cowBonus, sellPriceType: 'baseline' },
    expected: {
      slurryYear: r.production.slurry,
      strawYear: r.production.straw,
      manureYear: r.production.manure,
      feedTotalYear: r.production.totalFeed,
      salesYear: r.sales.porkSales,
      totalHectares: r.feedBreakdown.totalHectares,
    },
  })
}

// 8) HORSES ──────────────────────────────────────────────────────────────────
// expected: { strawYear, manureYear, feedTotalYear, salesYear, totalHectares }
const horseCount = 10
const horseSell = 4
for (const provideStraw of [true, false]) {
  const r = calculateHorses({
    numHorses: horseCount,
    yieldBonus: cowBonus,
    grassHarvests: cowGrassHarvests,
    sellCount: horseSell,
    provideStraw,
    baseCrop: toProtoHorseBase('oat'),
    rootCrop: toProtoRoot('potato'),
  })
  push({
    category: 'horse',
    label: `horse straw=${provideStraw}`,
    contractInputs: {
      species: 'horse',
      count: horseCount,
      yieldBonus: cowBonus,
      provideStraw,
      grassHarvests: cowGrassHarvests,
      baseCrop: 'oat',
      rootCrop: 'potato',
      sellCount: horseSell,
    },
    farmContext: { difficulty: 'normal', defaultYieldBonus: cowBonus, sellPriceType: 'baseline' },
    expected: {
      strawYear: r.production.straw,
      manureYear: r.production.manure,
      feedTotalYear: r.production.totalFeed,
      salesYear: r.sales.horseSales,
      totalHectares: r.feedBreakdown.totalHectares,
    },
  })
}

// 9) SPEED ───────────────────────────────────────────────────────────────────
// expected: { capacityHaPerH (sum over machines), decimalHours }
//   capacity = width*speed/10 ; effective = capacity*eff/100 ;
//   decimalHours = hectares / (sumCapacity * eff/100)
type SpeedSet = { name: string; machines: { width: number; speed: number }[] }
const speedSets: SpeedSet[] = [
  { name: 'single-6x12', machines: [{ width: 6, speed: 12 }] },
  { name: 'single-9x15', machines: [{ width: 9, speed: 15 }] },
  { name: 'team-6x12+9x15', machines: [{ width: 6, speed: 12 }, { width: 9, speed: 15 }] },
]
const speedHectares = 20
for (const set of speedSets) {
  for (const eff of [90, 100]) {
    const capacities = set.machines.map((m) => (m.width * m.speed) / 10)
    const sumCapacity = capacities.reduce((a, b) => a + b, 0)
    const effectiveCapacity = sumCapacity * (eff / 100)
    const decimalHours = speedHectares / effectiveCapacity
    push({
      category: 'speed',
      label: `speed ${set.name} eff=${eff}`,
      contractInputs: {
        machines: set.machines.map((m, i) => ({
          id: `m${i}`,
          name: `Tool ${i}`,
          workingWidthM: m.width,
          workingSpeedKmh: m.speed,
        })),
        // contract efficiency is 0..1 (the engine clamps to [0.5,1]).
        efficiency: eff / 100,
        hectares: speedHectares,
      },
      farmContext: { difficulty: 'normal', defaultYieldBonus: 0.425, sellPriceType: 'baseline' },
      expected: {
        capacityHaPerH: sumCapacity,
        decimalHours,
      },
    })
  }
}

// ── Write + report ───────────────────────────────────────────────────────────
const here = dirname(fileURLToPath(import.meta.url))
const outPath = join(here, 'golden.json')
writeFileSync(outPath, JSON.stringify(cases, null, 2) + '\n', 'utf8')

const counts: Record<string, number> = {}
for (const c of cases) counts[c.category] = (counts[c.category] ?? 0) + 1

// eslint-disable-next-line no-console
console.log(`Wrote ${cases.length} golden cases → ${outPath}`)
// eslint-disable-next-line no-console
console.log('Per-category counts:')
for (const cat of Object.keys(counts).sort()) {
  // eslint-disable-next-line no-console
  console.log(`  ${cat.padEnd(10)} ${counts[cat]}`)
}
