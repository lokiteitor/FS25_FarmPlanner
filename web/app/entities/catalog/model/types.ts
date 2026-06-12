// entities/catalog/model/types — TypeScript shapes for the versioned game
// catalogs, mirroring the `/catalog/*` schemas in docs/openapi.yaml and the
// seed data documented in docs/seeds-catalogo.md.
//
// All numeric fields are plain `number` (float); the BD stores `numeric`, the
// engine operates in float with tolerances (seeds-catalogo §"Precisión").

/** Difficulty levels (docs/openapi.yaml Difficulty enum). */
export type Difficulty = 'easy' | 'normal' | 'hard'

/** How the sell price is computed (docs/openapi.yaml SellPriceType enum). */
export type SellPriceType = 'baseline' | 'max_seasonal'

/** Animal species (docs/openapi.yaml AnimalSpecies enum). */
export type AnimalSpecies =
  | 'cow'
  | 'buffalo'
  | 'chicken'
  | 'sheep'
  | 'goat'
  | 'pig'
  | 'horse'

/** A scalar triple keyed by difficulty (income/difficulty scalars). */
export interface DifficultyScalars {
  easy: number
  normal: number
  hard: number
}

/** GameVersion (docs/openapi.yaml GameVersion). */
export interface GameVersion {
  id: string
  label: string
  isActive: boolean
  releasedAt?: string | null
}

/** A normal crop (docs/openapi.yaml Crop, seeds-catalogo §2). */
export interface Crop {
  id: string
  slug: string
  nameEs: string
  nameEn: string
  /** L/m². */
  yieldPerM2: number
  /** $/L baseline price. */
  basePrice: number
  /** Multiplier for the max seasonal price. */
  maxPriceFactor: number
  /** L/m² of seed needed. */
  seedRate: number
  /** t/m³ density. */
  weightPerLiter: number
}

/** A silage crop, referencing a base crop by slug (docs/openapi.yaml SilageCrop). */
export interface SilageCrop {
  id: string
  cropId: string
  cropSlug: string
  /** L/m² silage yield (own value, not derived from the base crop). */
  yieldPerM2: number
  /** Chaff multiplier applied to the silage yield. */
  chaffFactor: number
}

/** The main product an animal type produces (docs/openapi.yaml AnimalProduct). */
export interface AnimalProduct {
  slug: string
  basePrice: number
  /**
   * Price scalar applied to basePrice. `null` for milk-type products (cow/
   * buffalo) whose price uses `milkPriceScalars` instead (seeds-catalogo §4).
   */
  priceScalar?: number | null
}

/**
 * feed_options is heterogeneous per species (seeds-catalogo §4). We model the
 * union of all known shapes; consumers narrow by species. All sub-fields are
 * optional because not every species defines every block.
 */
export interface AnimalFeedComponent {
  /** Candidate crop slugs for this feed component. */
  crops?: string[]
  /** Liters consumed per animal per month for this component. */
  litersPerAnimalMonth: number
}

export interface AnimalFeedOptions {
  /** Ruminants: production multiplier per feedType (tmr/simple 1.0, hay 0.8, grass 0.4). */
  productivityFactors?: Partial<Record<string, number>>
  /** Ruminants: TMR composition ratios (hay/silage/straw/mineralFeed). */
  tmrRatios?: { hay: number; silage: number; straw: number; mineralFeed: number }
  /** Ruminants: silage crop slugs admitted. */
  silageCrops?: string[]
  /** Chicken: feed types that can be bought. */
  boughtFeedTypes?: string[]
  /** Chicken: crop slugs that can be grown for the non-bought %. */
  fieldworkCrops?: string[]
  /** Pig/horse: feed components keyed by component name (base/grain/protein/root/hay). */
  components?: Record<string, AnimalFeedComponent>
}

/** An animal type (docs/openapi.yaml AnimalType, seeds-catalogo §4). */
export interface AnimalType {
  id: string
  species: AnimalSpecies
  nameEs: string
  difficultyScalars: DifficultyScalars
  /** $ per head when sold; `null` when the species cannot be sold. */
  salePrice?: number | null
  /** Main product, or `null` (pig/horse have no product). */
  product?: AnimalProduct | null
  /** Liters/month per head; negative = consumption (seeds-catalogo §4). */
  monthlyRates: Record<string, number>
  feedOptions: AnimalFeedOptions
}

/** One monthly milk-price scalar entry (game year starts in March). */
export interface MilkPriceMonthly {
  month: number
  name?: string
  value: number
}

/** Milk price scalars (seeds-catalogo §5). */
export interface MilkPriceScalars {
  /** Baseline (≈ mean of the 12 monthly values). */
  average: number
  /** Max seasonal scalar (peak month). */
  max: number
  monthly: MilkPriceMonthly[]
}

/** Global balance constants (docs/openapi.yaml GameConstants, seeds-catalogo §5). */
export interface GameConstants {
  /** Default yield bonus (42.5%). */
  defaultYieldBonus: number
  /** Bonus for providing straw (+11.1%). */
  strawBonus: number
  /** $/L mineral feed. */
  mineralFeedPrice: number
  /** $/L silage. */
  silagePrice: number
  /** t/m³ silage. */
  silageWeight: number
  /** Straw yield per m² for fieldwork. */
  strawYieldPerM2: number
  /** Grass yield per m² for fieldwork. */
  grassYieldPerM2: number
  /** Animal yield-bonus scalar (1.425, corresponds to default bonus 0.425). */
  yieldBonusScalar: number
  /** Crop income multipliers by difficulty (easy 3.0 / normal 1.8 / hard 1.0). */
  incomeDifficultyScalars: DifficultyScalars
  /** Bought feed price scalars keyed by feed slug. */
  feedPurchasePrices: Record<string, number>
  /** Milk price scalars. */
  milkPriceScalars: MilkPriceScalars
}

/** A production building type from the catalog (mill, bakery, oil_mill…). */
export interface ProductionBuildingType {
  id: string
  slug: string
  nameEs: string
  nameEn: string
}

/** A manufactured product or raw material (non-crop) in the production catalog. */
export interface ProductionProduct {
  id: string
  slug: string
  nameEs: string
  nameEn: string
}

/** A single input or output line in a production chain recipe. */
export interface ProductionIO {
  slug: string
  quantityPerCycle: number
}

/** A production chain recipe from the catalog. */
export interface ProductionChain {
  id: string
  buildingTypeSlug: string
  slug: string
  nameEs: string
  nameEn: string
  cyclesPerMonth: number
  inputs: ProductionIO[]
  outputs: ProductionIO[]
}

/** Everything loaded for a single game version. */
export interface Catalog {
  gameVersionId: string
  crops: Crop[]
  silageCrops: SilageCrop[]
  animalTypes: AnimalType[]
  constants: GameConstants
  productionBuildingTypes: ProductionBuildingType[]
  productionProducts: ProductionProduct[]
  productionChains: ProductionChain[]
}
