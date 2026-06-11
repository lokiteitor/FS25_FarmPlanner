// tests/engine/fixtures — realistic seeded catalog data lifted verbatim from
// docs/seeds-catalogo.md, used to drive the engine unit tests. These assert
// INTERNAL CONSISTENCY and documented relationships (NOT byte-parity with the
// unavailable prototype).

import type {
  EngineAnimalType,
  EngineCatalog,
  EngineConstants,
  EngineCrop,
  EngineSilageCrop,
  FarmContext,
} from '~/shared/lib/engine'

// ── Crops (seeds-catalogo §2) ────────────────────────────────────────────────
export const wheat: EngineCrop = {
  slug: 'wheat',
  nameEs: 'Trigo',
  yieldPerM2: 0.89,
  basePrice: 0.337,
  maxPriceFactor: 1.21,
  seedRate: 0.0308,
  weightPerLiter: 0.78,
}

export const barley: EngineCrop = {
  slug: 'barley',
  nameEs: 'Cebada',
  yieldPerM2: 0.96,
  basePrice: 0.313,
  maxPriceFactor: 1.21,
  seedRate: 0.0265,
  weightPerLiter: 0.68,
}

export const corn: EngineCrop = {
  slug: 'corn',
  nameEs: 'Maíz',
  yieldPerM2: 0.92,
  basePrice: 0.38,
  maxPriceFactor: 1.33,
  seedRate: 0.0053,
  weightPerLiter: 0.8,
}

export const grass: EngineCrop = {
  slug: 'grass',
  nameEs: 'Hierba',
  yieldPerM2: 4.37,
  basePrice: 0.045,
  maxPriceFactor: 1.11,
  seedRate: 0.012,
  weightPerLiter: 0.3,
}

export const poplar: EngineCrop = {
  slug: 'poplar',
  nameEs: 'Álamo (Astillas de Madera)',
  yieldPerM2: 19.881,
  basePrice: 0.32,
  maxPriceFactor: 1.69,
  seedRate: 0.15,
  weightPerLiter: 0.35,
}

export const oat: EngineCrop = {
  slug: 'oat',
  nameEs: 'Avena',
  yieldPerM2: 0.57,
  basePrice: 0.532,
  maxPriceFactor: 1.21,
  seedRate: 0.034,
  weightPerLiter: 0.5,
}

export const soybean: EngineCrop = {
  slug: 'soybean',
  nameEs: 'Soja',
  yieldPerM2: 0.45,
  basePrice: 0.778,
  maxPriceFactor: 1.59,
  seedRate: 0.0214,
  weightPerLiter: 0.7,
}

export const potato: EngineCrop = {
  slug: 'potato',
  nameEs: 'Patatas',
  yieldPerM2: 4.13,
  basePrice: 0.222,
  maxPriceFactor: 1.15,
  seedRate: 0.3733,
  weightPerLiter: 0.75,
}

export const crops: EngineCrop[] = [wheat, barley, corn, grass, poplar, oat, soybean, potato]

// ── Silage crops (seeds-catalogo §3) ─────────────────────────────────────────
export const silageCrops: EngineSilageCrop[] = [
  { cropSlug: 'corn', yieldPerM2: 0.92, chaffFactor: 7.8 },
  { cropSlug: 'wheat', yieldPerM2: 0.89, chaffFactor: 4.0 },
  { cropSlug: 'barley', yieldPerM2: 0.96, chaffFactor: 4.0 },
  { cropSlug: 'oat', yieldPerM2: 0.57, chaffFactor: 4.0 },
  { cropSlug: 'soybean', yieldPerM2: 0.45, chaffFactor: 4.0 },
  { cropSlug: 'grass', yieldPerM2: 4.37, chaffFactor: 1.0 },
  { cropSlug: 'poplar', yieldPerM2: 6.627, chaffFactor: 3.0 },
]

// ── Constants (seeds-catalogo §5) ────────────────────────────────────────────
export const constants: EngineConstants = {
  defaultYieldBonus: 0.425,
  strawBonus: 0.11111111,
  mineralFeedPrice: 0.9523809524,
  silagePrice: 0.121,
  silageWeight: 0.3,
  strawYieldPerM2: 5.244,
  grassYieldPerM2: 4.37,
  yieldBonusScalar: 1.425,
  incomeDifficultyScalars: { easy: 3.0, normal: 1.8, hard: 1.0 },
  feedPurchasePrices: { oat: 1.4, wheat: 1.5 },
  milkPriceScalars: {
    average: 1.003333333,
    max: 1.09,
    monthly: [
      { month: 1, name: 'MAR', value: 1.06 },
      { month: 8, name: 'OCT', value: 1.09 },
    ],
  },
}

// ── Animal types (seeds-catalogo §4) ─────────────────────────────────────────
export const cow: EngineAnimalType = {
  species: 'cow',
  nameEs: 'Vacas',
  difficultyScalars: { easy: 3.0, normal: 1.8, hard: 1.0 },
  salePrice: 3500,
  product: { slug: 'milk', basePrice: 0.7, priceScalar: null },
  monthlyRates: { milk: 135, food: -350, slurry: 250, manure: 200, straw: -95 },
  feedOptions: {
    productivityFactors: { tmr: 1.0, simple: 1.0, hay: 0.8, grass: 0.4 },
    tmrRatios: { hay: 0.3744, silage: 0.3744, straw: 0.2032, mineralFeed: 0.048 },
    silageCrops: ['corn', 'barley', 'wheat', 'sorghum', 'sunflower', 'oat', 'canola', 'soybean', 'grass', 'poplar'],
  },
}

export const buffalo: EngineAnimalType = {
  species: 'buffalo',
  nameEs: 'Búfalos',
  difficultyScalars: { easy: 3.0, normal: 1.8, hard: 1.0 },
  salePrice: 3000,
  product: { slug: 'milk', basePrice: 3.5, priceScalar: null },
  monthlyRates: { milk: 4100, food: -10500, slurry: 2400, manure: 3600, straw: -200 },
  feedOptions: {
    productivityFactors: { tmr: 1.0, hay: 0.8, grass: 0.4 },
    tmrRatios: { hay: 0.3744, silage: 0.3744, straw: 0.2032, mineralFeed: 0.048 },
    silageCrops: ['corn', 'barley', 'wheat', 'sorghum', 'sunflower', 'oat', 'canola', 'soybean', 'grass', 'poplar'],
  },
}

export const chicken: EngineAnimalType = {
  species: 'chicken',
  nameEs: 'Gallinas',
  difficultyScalars: { easy: 3.0, normal: 1.8, hard: 1.0 },
  salePrice: null,
  product: { slug: 'eggs', basePrice: 1.12, priceScalar: 1.25 },
  monthlyRates: { eggs: 5, food: -5 },
  feedOptions: {
    boughtFeedTypes: ['oat', 'wheat'],
    fieldworkCrops: ['barley', 'wheat', 'sorghum'],
  },
}

export const sheep: EngineAnimalType = {
  species: 'sheep',
  nameEs: 'Ovejas',
  difficultyScalars: { easy: 3.0, normal: 1.8, hard: 1.0 },
  salePrice: 1000,
  product: { slug: 'wool', basePrice: 0.94, priceScalar: 1.29 },
  monthlyRates: { wool: 58.8235294117647, food: -48.5588235294117 },
  feedOptions: {},
}

export const goat: EngineAnimalType = {
  species: 'goat',
  nameEs: 'Cabras',
  difficultyScalars: { easy: 3.0, normal: 1.8, hard: 1.0 },
  salePrice: 1000,
  product: { slug: 'goat_milk', basePrice: 2.82, priceScalar: 1.08 },
  monthlyRates: { milk: 25, food: -50 },
  feedOptions: {},
}

export const pig: EngineAnimalType = {
  species: 'pig',
  nameEs: 'Cerdos',
  difficultyScalars: { easy: 3.0, normal: 1.8, hard: 1.0 },
  salePrice: 2500,
  product: null,
  monthlyRates: { slurry: 65, manure: 35, straw: -20 },
  feedOptions: {
    components: {
      base: { crops: ['corn', 'sorghum'], litersPerAnimalMonth: 30 },
      grain: { crops: ['wheat', 'barley'], litersPerAnimalMonth: 15 },
      protein: { crops: ['soybean', 'canola', 'sunflower'], litersPerAnimalMonth: 12 },
      root: { crops: ['potato', 'sugarbeet', 'redbeet', 'parsnip', 'carrot'], litersPerAnimalMonth: 3 },
    },
  },
}

export const horse: EngineAnimalType = {
  species: 'horse',
  nameEs: 'Caballos',
  difficultyScalars: { easy: 3.0, normal: 1.8, hard: 1.0 },
  salePrice: 5000,
  product: null,
  monthlyRates: { manure: 200, straw: -80 },
  feedOptions: {
    components: {
      base: { crops: ['oat', 'sorghum'], litersPerAnimalMonth: 95.25 },
      hay: { litersPerAnimalMonth: 285.75 },
      root: { crops: ['potato', 'sugarbeet', 'redbeet', 'parsnip', 'carrot'], litersPerAnimalMonth: 19.0625 },
    },
  },
}

export const animalTypes: EngineAnimalType[] = [cow, buffalo, chicken, sheep, goat, pig, horse]

// ── Assembled catalog + farm contexts ────────────────────────────────────────
export const catalog: EngineCatalog = { crops, silageCrops, animalTypes, constants }

export const normalFarm: FarmContext = {
  difficulty: 'normal',
  defaultYieldBonus: 0.425,
  sellPriceType: 'baseline',
}

export const hardFarm: FarmContext = {
  difficulty: 'hard',
  defaultYieldBonus: 0.425,
  sellPriceType: 'baseline',
}

export const easyFarm: FarmContext = {
  difficulty: 'easy',
  defaultYieldBonus: 0.425,
  sellPriceType: 'baseline',
}

export const maxSeasonalFarm: FarmContext = {
  difficulty: 'normal',
  defaultYieldBonus: 0.425,
  sellPriceType: 'max_seasonal',
}
