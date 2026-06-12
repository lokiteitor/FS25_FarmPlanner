// shared/lib/engine/types — pure, framework-agnostic input/output types for the
// calculation engine (ADR-F04).
//
// FSD: `shared` must NOT import `entities`, so the engine declares its own
// catalog subset (`EngineCatalog`) rather than importing entities/catalog. The
// shapes are STRUCTURALLY identical to the catalog entity types, so a real
// `Catalog` from the store is assignable to `EngineCatalog` at call sites with
// no conversion. The engine is parametrized by (catalog, farmContext, inputs)
// and never touches stores or the network.

export type Difficulty = 'easy' | 'normal' | 'hard'
export type SellPriceType = 'baseline' | 'max_seasonal'
export type AnimalSpecies =
  | 'cow'
  | 'buffalo'
  | 'chicken'
  | 'sheep'
  | 'goat'
  | 'pig'
  | 'horse'

export interface DifficultyScalars {
  easy: number
  normal: number
  hard: number
}

/** A value broken out per difficulty (used by the comparison tables). */
export interface ByDifficulty {
  easy: number
  normal: number
  hard: number
}

// --- Catalog subset consumed by the engine ----------------------------------

export interface EngineCrop {
  slug: string
  nameEs: string
  yieldPerM2: number
  basePrice: number
  maxPriceFactor: number
  seedRate: number
  weightPerLiter: number
}

export interface EngineSilageCrop {
  cropSlug: string
  yieldPerM2: number
  chaffFactor: number
}

export interface EngineAnimalProduct {
  slug: string
  basePrice: number
  priceScalar?: number | null
}

export interface EngineFeedComponent {
  crops?: string[]
  litersPerAnimalMonth: number
}

export interface EngineFeedOptions {
  productivityFactors?: Partial<Record<string, number>>
  tmrRatios?: { hay: number; silage: number; straw: number; mineralFeed: number }
  silageCrops?: string[]
  boughtFeedTypes?: string[]
  fieldworkCrops?: string[]
  components?: Record<string, EngineFeedComponent>
}

export interface EngineAnimalType {
  species: AnimalSpecies
  nameEs: string
  difficultyScalars: DifficultyScalars
  salePrice?: number | null
  product?: EngineAnimalProduct | null
  monthlyRates: Record<string, number>
  feedOptions: EngineFeedOptions
}

export interface EngineMilkPriceScalars {
  average: number
  max: number
  monthly: { month: number; name?: string; value: number }[]
}

export interface EngineConstants {
  defaultYieldBonus: number
  strawBonus: number
  mineralFeedPrice: number
  silagePrice: number
  silageWeight: number
  strawYieldPerM2: number
  grassYieldPerM2: number
  yieldBonusScalar: number
  incomeDifficultyScalars: DifficultyScalars
  feedPurchasePrices: Record<string, number>
  milkPriceScalars: EngineMilkPriceScalars
}

/**
 * The catalog subset the engine needs. A full `Catalog` from
 * entities/catalog is structurally assignable to this type.
 */
export interface EngineCatalog {
  crops: EngineCrop[]
  silageCrops: EngineSilageCrop[]
  animalTypes: EngineAnimalType[]
  constants: EngineConstants
}

// --- Farm context (lives on the farm, ADR-F04) ------------------------------

/**
 * Per-farm projection context. `difficulty` and `sellPriceType` come from the
 * active farm; `defaultYieldBonus` is the farm's default applied when a field /
 * animal config does not override `yieldBonus`.
 */
export interface FarmContext {
  difficulty: Difficulty
  defaultYieldBonus: number
  sellPriceType: SellPriceType
}

// --- Crop engine I/O --------------------------------------------------------

export interface CropProjectionInput {
  /** Field area in hectares. */
  hectares: number
  /** Field-level yield bonus override; falls back to farm.defaultYieldBonus. */
  yieldBonus?: number | null
  /** Whether the crop is harvested as silage (chopped). */
  isSilage?: boolean
}

export interface CropProjectionResult {
  /** Crop slug projected. */
  slug: string
  /** Spanish display name. */
  nameEs: string
  /** Field area in m². */
  areaM2: number
  /** Effective yield bonus used (override ?? farm default). */
  effectiveYieldBonus: number
  /** Whether this projection used the silage path. */
  isSilage: boolean
  /** Total harvested liters for the field (post yield-bonus). */
  yieldLiters: number
  /** Total harvested volume in m³ (= yieldLiters / 1000). */
  yieldM3: number
  /** Harvested tonnage (= yieldM3 * weight per liter, or silage weight). */
  yieldTons: number
  /** Effective price per liter (pre difficulty scalar), at the farm's sellPriceType. */
  pricePerLiter: number
  /** Gross income at the farm's difficulty and sellPriceType. */
  grossIncome: number
  /**
   * Gross income at each difficulty, at the farm's sellPriceType (kept for
   * widgets/crop-comparison-table which renders the table for the active farm).
   */
  incomeByDifficulty: ByDifficulty
  /**
   * Gross income at each difficulty using the BASELINE price (priceMult = 1).
   * Provided regardless of farm.sellPriceType so the comparison table can show
   * both baseline and max-seasonal columns. For silage this equals
   * incomeMaxSeasonal (silage has no seasonal price path).
   */
  incomeBaseline: ByDifficulty
  /**
   * Gross income at each difficulty using the MAX SEASONAL price
   * (priceMult = crop.maxPriceFactor; silage uses the constant silage price, so
   * its max-seasonal equals its baseline).
   */
  incomeMaxSeasonal: ByDifficulty
  /** Seed liters needed to plant the field (monetary cost is out of scope). */
  seedLitersNeeded: number
}

// --- Animal engine I/O ------------------------------------------------------

/**
 * Union-ish input for an animal projection. Each species reads only its
 * relevant fields (see docs/openapi.yaml *Inputs schemas). Kept as one flat
 * optional-field shape so callers can pass the discriminated config directly.
 */
export interface AnimalInputs {
  species: AnimalSpecies
  count: number
  yieldBonus?: number | null
  /** Ruminants: feed type (tmr/simple/hay/grass). */
  feedType?: 'tmr' | 'simple' | 'hay' | 'grass'
  /** Provide straw bonus (cow/buffalo/pig/horse). */
  provideStraw?: boolean
  /** Hay/grass fieldwork: number of grass harvests per year. */
  grassHarvests?: number
  /** Ruminants: silage crop slug used in the TMR ration. */
  silageCrop?: string | null
  /**
   * Buffalo: percentage of the herd that is lactating/productive (0..100).
   * INTERNAL engine field only — the API/openapi BuffaloInputs contract has no
   * such field, so it defaults to 100 when omitted (prototype parity). Do NOT
   * surface this on the API payload types.
   */
  percentProductive?: number
  /** Heads sold (cow/buffalo/sheep/goat/pig/horse). */
  sellCount?: number
  /** Chicken: % of feed bought (0..100). */
  boughtFeedPercent?: number
  /** Chicken: feed slug bought. */
  boughtFeedType?: string
  /** Chicken: crop slug grown for the non-bought %. */
  grownCrop?: string
  /** Pig/horse feed component crop selections. */
  baseCrop?: string
  grainCrop?: string
  proteinCrop?: string
  rootCrop?: string
}

/** One fieldwork requirement line (crop/grass/straw/mineral needed per year). */
export interface FieldworkRequirement {
  /** What this requirement is for (e.g. 'silage:corn', 'hay', 'straw', 'mineralFeed', 'feed:oat'). */
  key: string
  /** Crop/material slug, when applicable. */
  slug?: string
  /** Liters needed per year. */
  litersPerYear: number
  /** Hectares of field needed per year to grow it (when a yield is known). */
  hectaresNeeded?: number
  /** Monetary cost per year, when a price datum exists (bought feed/mineral). */
  costPerYear?: number
}

export interface AnimalProjectionResult {
  species: AnimalSpecies
  nameEs: string
  count: number
  /** Effective yield bonus used. */
  effectiveYieldBonus: number
  /** Production factor = 1 + effectiveYieldBonus. */
  productionFactor: number
  /** Feed productivity factor (ruminants), else 1. */
  feedProductivityFactor: number
  /** Straw bonus factor applied (1 + strawBonus when provideStraw, else 1). */
  strawBonusFactor: number
  /** Difficulty scalar (== income scalar) applied to revenue. */
  difficultyScalar: number

  /** Production lines (positive monthly_rates), annualized for the herd. */
  production: {
    /** Primary product slug (milk/eggs/wool/goat_milk), if any. */
    productSlug?: string | null
    /** Primary product liters/year for the herd. */
    productLitersPerYear: number
    /** Primary product liters/month for the herd. */
    productLitersPerMonth: number
    /** All positive rates annualized, keyed by rate name (incl. slurry/manure). */
    byKey: Record<string, { perMonth: number; perYear: number }>
  }

  /** Consumption lines (negative monthly_rates), annualized for the herd. */
  consumption: {
    byKey: Record<string, { perMonth: number; perYear: number }>
  }

  economics: {
    /** Revenue from selling the product over a year. */
    productRevenue: number
    /** Revenue from selling heads (sellCount * salePrice). */
    salesRevenue: number
    /** Cost of bought feed + mineral feed per year, when known. */
    feedCost: number
    /** productRevenue + salesRevenue - feedCost. */
    net: number
    /** Effective price per product liter used (after scalars). */
    productPricePerLiter: number
  }

  /** Feed / fieldwork breakdown (requirements to sustain the herd). */
  fieldwork: {
    requirements: FieldworkRequirement[]
    /** Total hectares of field needed per year (sum of known requirements). */
    totalHectaresNeeded: number
  }
}

// --- Work-time (speed) calculator I/O (H7.6) --------------------------------
//
// PURE work-time projection. Reconstructed from standard FS25 fieldwork
// throughput semantics (NOT ported from the unavailable prototype):
//
//   capacityHaPerH = workingWidthM * workingSpeedKmh / 10
//     Derivation: a tool of width W (m) advancing at v (km/h) sweeps
//     W * (v * 1000 m/h) = W*v*1000 m²/h. Dividing by 10 000 m²/ha gives
//     W*v/10 ha/h. So the documented "/10" already folds in the m→km and
//     m²→ha conversions.
//   effectiveCapacityHaPerH = capacityHaPerH * efficiency   (per machine)
//   teamCapacityHaPerH = Σ effectiveCapacityHaPerH over selected machines
//     Machines working the SAME field in parallel add their throughput.
//   workHours = hectares / teamCapacityHaPerH                (0 team ⇒ null)
//
// `efficiency` (0.5..1, WorkSpeedState.efficiency) discounts the nameplate
// throughput for overlap, turning, refills and headlands.

/** A machine fed into the work-speed engine (subset of entities Machine). */
export interface SpeedMachineInput {
  /** Stable identity, echoed back in the per-machine breakdown. */
  id: string
  /** Display name (catalog-independent; from the machinery entity). */
  name: string
  /** Working width in metres (> 0). */
  workingWidthM: number
  /** Working speed in km/h (> 0). */
  workingSpeedKmh: number
}

/** Per-machine contribution line in a work-speed result. */
export interface SpeedMachineBreakdown {
  id: string
  name: string
  workingWidthM: number
  workingSpeedKmh: number
  /** Nameplate throughput = workingWidthM * workingSpeedKmh / 10 (ha/h). */
  capacityHaPerH: number
  /** Throughput after the efficiency factor (ha/h). */
  effectiveCapacityHaPerH: number
  /** Hours this machine alone would take for the whole area (null if it has no throughput). */
  soloWorkHours: number | null
  /** Share of the team's combined throughput (0..1); 0 when the team is idle. */
  shareOfTeam: number
}

/** Inputs to {@link workSpeedProjection}. */
export interface WorkSpeedInput {
  /** Area to work, in hectares (≥ 0). */
  hectares: number
  /** Efficiency factor 0.5..1 (clamped). */
  efficiency: number
  /** Selected machines working the field in parallel. */
  machines: SpeedMachineInput[]
}

// --- Production engine I/O --------------------------------------------------
//
// The production engine is parametrized ONLY by the building + its resolved
// chains; it does NOT use EngineCatalog or FarmContext (production quantities
// are independent of difficulty and yield bonus).
// The caller (the widget composable) resolves overrides (cyclesPerMonth,
// inputs, outputs) before passing chains to the engine.

/** A single input or output line in a resolved production chain recipe. */
export interface EngineProductionIO {
  slug: string
  /** Optional display label resolved by the frontend (crop or product name). */
  label?: string
  quantityPerCycle: number
}

/** A production chain with all overrides already resolved — ready for the engine. */
export interface EngineProductionChain {
  id: string
  name: string
  isActive: boolean
  cyclesPerMonth: number
  inputs: EngineProductionIO[]
  outputs: EngineProductionIO[]
}

/** A production building ready for the engine (building + resolved chains). */
export interface EngineProductionBuilding {
  id: string
  name: string
  buildingTypeSlug: string
  chains: EngineProductionChain[]
}

/** Monthly result for a single chain inside a building. */
export interface ProductionChainResult {
  chainId: string
  name: string
  isActive: boolean
  /** Effective cycles = baseCyclesPerMonth / activeChainCount. */
  effectiveCyclesPerMonth: number
  inputsPerMonth: { slug: string; label?: string; quantityPerMonth: number }[]
  outputsPerMonth: { slug: string; label?: string; quantityPerMonth: number }[]
}

/** Monthly production result for a whole building (all chains aggregated). */
export interface ProductionBuildingResult {
  buildingId: string
  buildingName: string
  buildingTypeSlug: string
  activeChainCount: number
  chains: ProductionChainResult[]
  /** Sum of all inputs across active chains, keyed by slug. */
  totalInputsPerMonth: { slug: string; label?: string; quantityPerMonth: number }[]
  /** Sum of all outputs across active chains, keyed by slug. */
  totalOutputsPerMonth: { slug: string; label?: string; quantityPerMonth: number }[]
}

/** Result of a work-time projection. */
export interface WorkSpeedResult {
  /** Echoed area (hectares). */
  hectares: number
  /** Echoed efficiency factor actually applied (post-clamp). */
  efficiency: number
  /** Sum of nameplate throughputs of the selected machines (ha/h). */
  totalCapacityHaPerH: number
  /** Sum of post-efficiency throughputs (ha/h); the team rate. */
  effectiveCapacityHaPerH: number
  /** Total work time in hours, or null when no machine has throughput. */
  workHours: number | null
  /** Whole-hours component of {@link workHours} (null when workHours is null). */
  hours: number | null
  /** Remaining minutes component of {@link workHours} (null when workHours is null). */
  minutes: number | null
  /** Per-machine breakdown, in input order. */
  perMachine: SpeedMachineBreakdown[]
}
