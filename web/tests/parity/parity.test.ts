// tests/parity/parity.test — PARITY harness skeleton.
//
// Loads the golden reference values (extracted from THE PROTOTYPE by
// tests/parity/generateGolden.ts) and asserts that the WEB engine
// (app/shared/lib/engine), fed the same inputs through the parity catalog,
// reproduces the prototype's comparable outputs within a RELATIVE tolerance of
// 1e-6.
//
// ── STATUS ────────────────────────────────────────────────────────────────────
// It is EXPECTED that this suite FAILS today: the reconstructed engine diverges
// from the prototype in documented ways (see docs / the task "CRITICAL PROTOTYPE
// FACTS"), e.g.:
//   · animal PRODUCTION is scaled by (1+yieldBonus) in the engine but NOT in the
//     prototype (cow/buffalo milk, eggs, wool, goat milk, slurry, manure);
//   · cow straw bonus is applied to ALL production in the engine, only to milk in
//     the prototype;
//   · crop yieldTons uses liters*weight in the engine but m³*weight in the proto
//     (×1000); we divide by 1000 below to compare in the proto's units, but the
//     other animal divergences remain.
// The RECONCILE phase makes these pass. The harness itself LOADS and RUNS — only
// the numeric assertions fail.
//
// ── ENGINE RESULT FIELD → COMPARABLE MAP ──────────────────────────────────────
// CROP (cropProjection / incomeByDifficulty):
//   yieldM3            = result.yieldM3              (= yieldLiters / 1000)
//   yieldTons          = result.yieldTons            (= yieldM3 × weight, proto units)
//   incomeBaseline     = result.incomeBaseline       (≡ incomeByDifficulty(...,'baseline'))
//   incomeMaxSeasonal  = result.incomeMaxSeasonal    (≡ incomeByDifficulty(...,'max_seasonal'))
//                        (silage: engine has no seasonal path → equals baseline,
//                         matching the prototype)
// COW / BUFFALO (animalProjection):
//   milkLitersYear     = production.productLitersPerYear
//   milkRevenueYear    = economics.productRevenue
//   slurryYear         = production.byKey.slurry.perYear
//   manureYear         = production.byKey.manure.perYear
//   strawYear          = -consumption.byKey.straw.perYear   (proto reports straw as negative)
//   foodYear           = -consumption.byKey.food.perYear    (proto reports food as negative)
//   salesYear          = economics.salesRevenue
//   mineralCostYear    = requirement key 'mineralFeed' → costPerYear (0 when absent)
//   tmrTotalHectares   = fieldwork.totalHectaresNeeded     (TMR cases; 0 otherwise per golden)
//   fieldworkHectares  = fieldwork.totalHectaresNeeded
// CHICKEN (animalProjection):
//   eggsYear           = production.productLitersPerYear
//   revenueYear        = economics.productRevenue
//   feedTotalYear      = consumption.byKey.food.perYear
//   feedBought         = requirement key 'feed:<slug>' → litersPerYear (0 when absent)
//   feedGrown          = requirement key 'grown:<slug>' → litersPerYear (0 when absent)
//   feedCostYear       = economics.feedCost
//   fieldworkHectares  = fieldwork.totalHectaresNeeded
//   netYear            = economics.net
// SHEEP / GOAT (animalProjection):
//   woolLitersYear / milkLitersYear = production.productLitersPerYear
//   revenueYear        = economics.productRevenue
//   feedYear           = consumption.byKey.food.perYear
//   fieldworkHectares  = fieldwork.totalHectaresNeeded
// PIG / HORSE (animalProjection):
//   slurryYear         = production.byKey.slurry.perYear (pig only)
//   strawYear          = -consumption.byKey.straw.perYear
//   manureYear         = production.byKey.manure.perYear
//   feedTotalYear      = sum of feed requirement litersPerYear (feed:* components)
//   salesYear          = economics.salesRevenue
//   totalHectares      = fieldwork.totalHectaresNeeded
// SPEED (workSpeedProjection):
//   capacityHaPerH     = result.totalCapacityHaPerH
//   decimalHours       = result.workHours

import { describe, expect, it } from 'vitest'
import {
  animalProjection,
  cropProjection,
  incomeByDifficulty,
  workSpeedProjection,
} from '~/shared/lib/engine'
import type {
  AnimalInputs,
  AnimalProjectionResult,
  ByDifficulty,
  EngineCatalog,
  FarmContext,
  SpeedMachineInput,
} from '~/shared/lib/engine'
import { buildParityCatalog } from './catalogFixture'
import goldenCases from './golden.json'

// ── golden.json shape ────────────────────────────────────────────────────────
interface GoldenCase {
  category: string
  label: string
  contractInputs: Record<string, unknown>
  farmContext: FarmContext
  expected: Record<string, unknown>
}

const golden = goldenCases as unknown as GoldenCase[]

// ── tolerance helper ─────────────────────────────────────────────────────────
const REL_TOL = 1e-6
/** abs(a-b) <= 1e-6 * max(1, abs(b)). */
function closeTo(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= REL_TOL * Math.max(1, Math.abs(expected))
}
function expectClose(actual: number, expected: number, what: string): void {
  expect(
    closeTo(actual, expected),
    `${what}: expected ≈ ${expected}, got ${actual} (Δ=${Math.abs(actual - expected)})`,
  ).toBe(true)
}

function expectByDifficulty(actual: ByDifficulty, expected: ByDifficulty, what: string): void {
  expectClose(actual.easy, expected.easy, `${what}.easy`)
  expectClose(actual.normal, expected.normal, `${what}.normal`)
  expectClose(actual.hard, expected.hard, `${what}.hard`)
}

const catalog: EngineCatalog = buildParityCatalog()

// ── helpers to read engine results into the proto's comparable encoding ───────
const productYear = (r: AnimalProjectionResult): number => r.production.productLitersPerYear
const byKeyYear = (r: AnimalProjectionResult, key: string): number =>
  r.production.byKey[key]?.perYear ?? 0
const consumeYear = (r: AnimalProjectionResult, key: string): number =>
  r.consumption.byKey[key]?.perYear ?? 0
const reqByKey = (r: AnimalProjectionResult, key: string) =>
  r.fieldwork.requirements.find((req) => req.key === key)
const reqLitersStartsWith = (r: AnimalProjectionResult, prefix: string): number =>
  r.fieldwork.requirements
    .filter((req) => req.key.startsWith(prefix))
    .reduce((sum, req) => sum + req.litersPerYear, 0)

function toAnimalInputs(ci: Record<string, unknown>): AnimalInputs {
  return ci as unknown as AnimalInputs
}

// ── per-category assertions ───────────────────────────────────────────────────
function assertCrop(c: GoldenCase): void {
  const ci = c.contractInputs
  const slug = ci.slug as string
  const hectares = ci.hectares as number
  const bonus = ci.yieldBonus as number
  const isSilage = Boolean(ci.isSilage)
  const crop = catalog.crops.find((x) => x.slug === slug)
  if (!crop) throw new Error(`crop fixture missing slug "${slug}"`)

  const proj = cropProjection(crop, { hectares, yieldBonus: bonus, isSilage }, c.farmContext, catalog)
  const exp = c.expected as {
    yieldM3: number
    yieldTons: number
    incomeBaseline: ByDifficulty
    incomeMaxSeasonal: ByDifficulty
  }

  expectClose(proj.yieldM3, exp.yieldM3, `${c.label} yieldM3`)
  expectClose(proj.yieldTons, exp.yieldTons, `${c.label} yieldTons`)

  if (isSilage) {
    // Silage has no seasonal path in the engine: both tables use silagePrice.
    const liters = proj.yieldLiters
    const base: ByDifficulty = {
      easy: liters * proj.pricePerLiter * catalog.constants.incomeDifficultyScalars.easy,
      normal: liters * proj.pricePerLiter * catalog.constants.incomeDifficultyScalars.normal,
      hard: liters * proj.pricePerLiter * catalog.constants.incomeDifficultyScalars.hard,
    }
    expectByDifficulty(base, exp.incomeBaseline, `${c.label} incomeBaseline`)
    expectByDifficulty(base, exp.incomeMaxSeasonal, `${c.label} incomeMaxSeasonal`)
  } else {
    const base = incomeByDifficulty(crop, hectares, bonus, catalog.constants, 'baseline')
    const max = incomeByDifficulty(crop, hectares, bonus, catalog.constants, 'max_seasonal')
    expectByDifficulty(base, exp.incomeBaseline, `${c.label} incomeBaseline`)
    expectByDifficulty(max, exp.incomeMaxSeasonal, `${c.label} incomeMaxSeasonal`)
  }
}

function assertCowOrBuffalo(c: GoldenCase): void {
  const r = animalProjection(toAnimalInputs(c.contractInputs), c.farmContext, catalog)
  const exp = c.expected as Record<string, number>
  const feedType = c.contractInputs.feedType as string
  const mineral = reqByKey(r, 'mineralFeed')

  expectClose(productYear(r), exp.milkLitersYear, `${c.label} milkLitersYear`)
  expectClose(r.economics.productRevenue, exp.milkRevenueYear, `${c.label} milkRevenueYear`)
  expectClose(byKeyYear(r, 'slurry'), exp.slurryYear, `${c.label} slurryYear`)
  expectClose(byKeyYear(r, 'manure'), exp.manureYear, `${c.label} manureYear`)
  expectClose(-consumeYear(r, 'straw'), exp.strawYear, `${c.label} strawYear`)
  expectClose(-consumeYear(r, 'food'), exp.foodYear, `${c.label} foodYear`)
  expectClose(r.economics.salesRevenue, exp.salesYear, `${c.label} salesYear`)
  expectClose(mineral?.costPerYear ?? 0, exp.mineralCostYear, `${c.label} mineralCostYear`)
  const tmrTotal = feedType === 'tmr' ? r.fieldwork.totalHectaresNeeded : 0
  expectClose(tmrTotal, exp.tmrTotalHectares, `${c.label} tmrTotalHectares`)
  expectClose(r.fieldwork.totalHectaresNeeded, exp.fieldworkHectares, `${c.label} fieldworkHectares`)
}

function assertChicken(c: GoldenCase): void {
  const r = animalProjection(toAnimalInputs(c.contractInputs), c.farmContext, catalog)
  const exp = c.expected as Record<string, number>
  const boughtType = c.contractInputs.boughtFeedType as string
  const grownCrop = c.contractInputs.grownCrop as string
  const boughtReq = reqByKey(r, `feed:${boughtType}`)
  const grownReq = reqByKey(r, `grown:${grownCrop}`)

  expectClose(productYear(r), exp.eggsYear, `${c.label} eggsYear`)
  expectClose(r.economics.productRevenue, exp.revenueYear, `${c.label} revenueYear`)
  expectClose(consumeYear(r, 'food'), exp.feedTotalYear, `${c.label} feedTotalYear`)
  expectClose(boughtReq?.litersPerYear ?? 0, exp.feedBought, `${c.label} feedBought`)
  expectClose(grownReq?.litersPerYear ?? 0, exp.feedGrown, `${c.label} feedGrown`)
  expectClose(r.economics.feedCost, exp.feedCostYear, `${c.label} feedCostYear`)
  expectClose(r.fieldwork.totalHectaresNeeded, exp.fieldworkHectares, `${c.label} fieldworkHectares`)
  expectClose(r.economics.net, exp.netYear, `${c.label} netYear`)
}

function assertSheep(c: GoldenCase): void {
  const r = animalProjection(toAnimalInputs(c.contractInputs), c.farmContext, catalog)
  const exp = c.expected as Record<string, number>
  expectClose(productYear(r), exp.woolLitersYear, `${c.label} woolLitersYear`)
  expectClose(r.economics.productRevenue, exp.revenueYear, `${c.label} revenueYear`)
  expectClose(consumeYear(r, 'food'), exp.feedYear, `${c.label} feedYear`)
  expectClose(r.fieldwork.totalHectaresNeeded, exp.fieldworkHectares, `${c.label} fieldworkHectares`)
}

function assertGoat(c: GoldenCase): void {
  const r = animalProjection(toAnimalInputs(c.contractInputs), c.farmContext, catalog)
  const exp = c.expected as Record<string, number>
  expectClose(productYear(r), exp.milkLitersYear, `${c.label} milkLitersYear`)
  expectClose(r.economics.productRevenue, exp.revenueYear, `${c.label} revenueYear`)
  expectClose(consumeYear(r, 'food'), exp.feedYear, `${c.label} feedYear`)
  expectClose(r.fieldwork.totalHectaresNeeded, exp.fieldworkHectares, `${c.label} fieldworkHectares`)
}

function assertPig(c: GoldenCase): void {
  const r = animalProjection(toAnimalInputs(c.contractInputs), c.farmContext, catalog)
  const exp = c.expected as Record<string, number>
  expectClose(byKeyYear(r, 'slurry'), exp.slurryYear, `${c.label} slurryYear`)
  expectClose(-consumeYear(r, 'straw'), exp.strawYear, `${c.label} strawYear`)
  expectClose(byKeyYear(r, 'manure'), exp.manureYear, `${c.label} manureYear`)
  expectClose(reqLitersStartsWith(r, 'feed:'), exp.feedTotalYear, `${c.label} feedTotalYear`)
  expectClose(r.economics.salesRevenue, exp.salesYear, `${c.label} salesYear`)
  expectClose(r.fieldwork.totalHectaresNeeded, exp.totalHectares, `${c.label} totalHectares`)
}

function assertHorse(c: GoldenCase): void {
  const r = animalProjection(toAnimalInputs(c.contractInputs), c.farmContext, catalog)
  const exp = c.expected as Record<string, number>
  expectClose(-consumeYear(r, 'straw'), exp.strawYear, `${c.label} strawYear`)
  expectClose(byKeyYear(r, 'manure'), exp.manureYear, `${c.label} manureYear`)
  // horse feed: base + hay + root requirements (hay carries key 'hay').
  const feedTotal =
    reqLitersStartsWith(r, 'feed:') + (reqByKey(r, 'hay')?.litersPerYear ?? 0)
  expectClose(feedTotal, exp.feedTotalYear, `${c.label} feedTotalYear`)
  expectClose(r.economics.salesRevenue, exp.salesYear, `${c.label} salesYear`)
  expectClose(r.fieldwork.totalHectaresNeeded, exp.totalHectares, `${c.label} totalHectares`)
}

function assertSpeed(c: GoldenCase): void {
  const ci = c.contractInputs
  const machines = ci.machines as SpeedMachineInput[]
  const efficiency = ci.efficiency as number
  const hectares = ci.hectares as number
  const r = workSpeedProjection({ machines, efficiency, hectares })
  const exp = c.expected as { capacityHaPerH: number; decimalHours: number }
  expectClose(r.totalCapacityHaPerH, exp.capacityHaPerH, `${c.label} capacityHaPerH`)
  expectClose(r.workHours ?? Number.NaN, exp.decimalHours, `${c.label} decimalHours`)
}

const ASSERTERS: Record<string, (c: GoldenCase) => void> = {
  crop: assertCrop,
  cow: assertCowOrBuffalo,
  buffalo: assertCowOrBuffalo,
  chicken: assertChicken,
  sheep: assertSheep,
  goat: assertGoat,
  pig: assertPig,
  horse: assertHorse,
  speed: assertSpeed,
}

// ── suite ─────────────────────────────────────────────────────────────────────
describe('engine ↔ prototype parity (golden.json)', () => {
  it('golden.json loaded with cases', () => {
    expect(golden.length).toBeGreaterThan(0)
  })

  const byCategory = new Map<string, GoldenCase[]>()
  for (const c of golden) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, [])
    byCategory.get(c.category)!.push(c)
  }

  for (const [category, cases] of byCategory) {
    describe(category, () => {
      const assert = ASSERTERS[category]
      for (const c of cases) {
        it(c.label, () => {
          if (!assert) throw new Error(`no asserter registered for category "${category}"`)
          assert(c)
        })
      }
    })
  }
})
