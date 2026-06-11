// tests/parity/catalogFixture — a COMPLETE EngineCatalog assembled from the
// EXACT seed values (api/src/db/seeds/*.ts ≡ docs/seeds-catalogo.md). These
// numbers equal the prototype's data for the parity-relevant fields, so feeding
// this catalog to the web engine reproduces the prototype's inputs.
//
// Used by tests/parity/parity.test.ts. Every crop, silage crop and animal type
// exercised by the parity grid is present here with verbatim seed numbers.
//
// NOTE: the engine consumes the structural `EngineCatalog` subset
// (shared/lib/engine/types). The catalog entity (entities/catalog) carries a
// few extra id fields; those are not needed by the engine, so this fixture
// builds the engine subset directly.

import type {
  EngineAnimalType,
  EngineCatalog,
  EngineConstants,
  EngineCrop,
  EngineSilageCrop,
} from '~/shared/lib/engine'

// ── Crops (25) — api/src/db/seeds/crops.ts ───────────────────────────────────
const crops: EngineCrop[] = [
  { slug: 'barley', nameEs: 'Cebada', yieldPerM2: 0.96, basePrice: 0.313, maxPriceFactor: 1.21, seedRate: 0.0265, weightPerLiter: 0.68 },
  { slug: 'onion', nameEs: 'Cebollas', yieldPerM2: 7.0, basePrice: 0.75, maxPriceFactor: 3.0, seedRate: 0.0005, weightPerLiter: 1.0 },
  { slug: 'redbeet', nameEs: 'Remolacha', yieldPerM2: 5.78, basePrice: 0.122, maxPriceFactor: 1.15, seedRate: 0.004, weightPerLiter: 0.52 },
  { slug: 'canola', nameEs: 'Canola', yieldPerM2: 0.58, basePrice: 0.603, maxPriceFactor: 1.21, seedRate: 0.0049, weightPerLiter: 0.6 },
  { slug: 'carrot', nameEs: 'Zanahoria', yieldPerM2: 7.7, basePrice: 0.132, maxPriceFactor: 1.15, seedRate: 0.001, weightPerLiter: 0.64 },
  { slug: 'corn', nameEs: 'Maíz', yieldPerM2: 0.92, basePrice: 0.38, maxPriceFactor: 1.33, seedRate: 0.0053, weightPerLiter: 0.8 },
  { slug: 'cotton', nameEs: 'Algodón', yieldPerM2: 0.497, basePrice: 1.252, maxPriceFactor: 1.11, seedRate: 0.005, weightPerLiter: 0.23 },
  { slug: 'grape', nameEs: 'Uva', yieldPerM2: 1.84, basePrice: 0.603, maxPriceFactor: 1.2, seedRate: 0.0, weightPerLiter: 0.6 },
  { slug: 'green_beans', nameEs: 'Judías Verdes', yieldPerM2: 0.6975, basePrice: 0.72, maxPriceFactor: 1.05, seedRate: 0.028, weightPerLiter: 0.42 },
  { slug: 'oat', nameEs: 'Avena', yieldPerM2: 0.57, basePrice: 0.532, maxPriceFactor: 1.21, seedRate: 0.034, weightPerLiter: 0.5 },
  { slug: 'olive', nameEs: 'Oliva', yieldPerM2: 1.84, basePrice: 0.603, maxPriceFactor: 1.2, seedRate: 0.0, weightPerLiter: 0.6 },
  { slug: 'parsnip', nameEs: 'Chirivía', yieldPerM2: 6.95, basePrice: 0.131, maxPriceFactor: 1.15, seedRate: 0.001, weightPerLiter: 0.58 },
  { slug: 'pea', nameEs: 'Guisantes', yieldPerM2: 0.96, basePrice: 1.04, maxPriceFactor: 1.1, seedRate: 0.025, weightPerLiter: 0.72 },
  { slug: 'potato', nameEs: 'Patatas', yieldPerM2: 4.13, basePrice: 0.222, maxPriceFactor: 1.15, seedRate: 0.3733, weightPerLiter: 0.75 },
  { slug: 'rice_long_grain', nameEs: 'Arroz (Largo)', yieldPerM2: 0.9, basePrice: 0.53, maxPriceFactor: 1.05, seedRate: 0.05, weightPerLiter: 0.77 },
  { slug: 'rice', nameEs: 'Arroz (Corto)', yieldPerM2: 0.66, basePrice: 1.1, maxPriceFactor: 1.05, seedRate: 0.015625, weightPerLiter: 0.79 },
  { slug: 'sorghum', nameEs: 'Sorgo', yieldPerM2: 0.82, basePrice: 0.43, maxPriceFactor: 1.22, seedRate: 0.0035, weightPerLiter: 0.85 },
  { slug: 'soybean', nameEs: 'Soja', yieldPerM2: 0.45, basePrice: 0.778, maxPriceFactor: 1.59, seedRate: 0.0214, weightPerLiter: 0.7 },
  { slug: 'spinach', nameEs: 'Espinacas', yieldPerM2: 2.31, basePrice: 0.22, maxPriceFactor: 1.05, seedRate: 0.001, weightPerLiter: 0.13 },
  { slug: 'sugarbeet', nameEs: 'Remolacha Azucarera', yieldPerM2: 5.78, basePrice: 0.172, maxPriceFactor: 1.15, seedRate: 0.0034, weightPerLiter: 0.7 },
  { slug: 'sugarcane', nameEs: 'Caña de Azúcar', yieldPerM2: 11.34, basePrice: 0.119, maxPriceFactor: 1.05, seedRate: 1.2, weightPerLiter: 0.18 },
  { slug: 'sunflower', nameEs: 'Girasol', yieldPerM2: 0.52, basePrice: 0.673, maxPriceFactor: 1.2, seedRate: 0.0143, weightPerLiter: 0.35 },
  { slug: 'wheat', nameEs: 'Trigo', yieldPerM2: 0.89, basePrice: 0.337, maxPriceFactor: 1.21, seedRate: 0.0308, weightPerLiter: 0.78 },
  { slug: 'grass', nameEs: 'Hierba', yieldPerM2: 4.37, basePrice: 0.045, maxPriceFactor: 1.11, seedRate: 0.012, weightPerLiter: 0.3 },
  { slug: 'poplar', nameEs: 'Álamo (Astillas de Madera)', yieldPerM2: 19.881, basePrice: 0.32, maxPriceFactor: 1.69, seedRate: 0.15, weightPerLiter: 0.35 },
]

// ── Silage crops (10) — api/src/db/seeds/silageCrops.ts ──────────────────────
const silageCrops: EngineSilageCrop[] = [
  { cropSlug: 'barley', yieldPerM2: 0.96, chaffFactor: 4.0 },
  { cropSlug: 'canola', yieldPerM2: 0.58, chaffFactor: 4.0 },
  { cropSlug: 'corn', yieldPerM2: 0.92, chaffFactor: 7.8 },
  { cropSlug: 'oat', yieldPerM2: 0.57, chaffFactor: 4.0 },
  { cropSlug: 'sorghum', yieldPerM2: 0.82, chaffFactor: 4.0 },
  { cropSlug: 'soybean', yieldPerM2: 0.45, chaffFactor: 4.0 },
  { cropSlug: 'sunflower', yieldPerM2: 0.52, chaffFactor: 6.0 },
  { cropSlug: 'wheat', yieldPerM2: 0.89, chaffFactor: 4.0 },
  { cropSlug: 'grass', yieldPerM2: 4.37, chaffFactor: 1.0 },
  { cropSlug: 'poplar', yieldPerM2: 6.627, chaffFactor: 3.0 },
]

// ── Constants — api/src/db/seeds/gameConstants.ts ────────────────────────────
const constants: EngineConstants = {
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
      { month: 2, name: 'APR', value: 1.01 },
      { month: 3, name: 'MAY', value: 0.96 },
      { month: 4, name: 'JUN', value: 0.9 },
      { month: 5, name: 'JUL', value: 0.95 },
      { month: 6, name: 'AUG', value: 0.95 },
      { month: 7, name: 'SEP', value: 1.03 },
      { month: 8, name: 'OCT', value: 1.09 },
      { month: 9, name: 'NOV', value: 0.98 },
      { month: 10, name: 'DEC', value: 0.96 },
      { month: 11, name: 'JAN', value: 1.08 },
      { month: 12, name: 'FEB', value: 1.07 },
    ],
  },
}

// ── Animal types (7) — api/src/db/seeds/animalTypes.ts ───────────────────────
const animalTypes: EngineAnimalType[] = [
  {
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
  },
  {
    species: 'buffalo',
    nameEs: 'Búfalos',
    difficultyScalars: { easy: 3.0, normal: 1.8, hard: 1.0 },
    salePrice: 3000,
    product: { slug: 'buffalo_milk', basePrice: 3.5, priceScalar: null },
    monthlyRates: { milk: 4100, food: -10500, slurry: 2400, manure: 3600, straw: -200 },
    feedOptions: {
      productivityFactors: { tmr: 1.0, hay: 0.8, grass: 0.4 },
      tmrRatios: { hay: 0.3744, silage: 0.3744, straw: 0.2032, mineralFeed: 0.048 },
      silageCrops: ['corn', 'barley', 'wheat', 'sorghum', 'sunflower', 'oat', 'canola', 'soybean', 'grass', 'poplar'],
    },
  },
  {
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
  },
  {
    species: 'sheep',
    nameEs: 'Ovejas',
    difficultyScalars: { easy: 3.0, normal: 1.8, hard: 1.0 },
    salePrice: 1000,
    product: { slug: 'wool', basePrice: 0.94, priceScalar: 1.29 },
    monthlyRates: { wool: 58.8235294117647, food: -48.5588235294117 },
    feedOptions: {},
  },
  {
    species: 'goat',
    nameEs: 'Cabras',
    difficultyScalars: { easy: 3.0, normal: 1.8, hard: 1.0 },
    salePrice: 1000,
    product: { slug: 'goat_milk', basePrice: 2.82, priceScalar: 1.08 },
    monthlyRates: { milk: 25, food: -50 },
    feedOptions: {},
  },
  {
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
  },
  {
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
  },
]

/** A complete EngineCatalog built from the exact seed values. */
export function buildParityCatalog(): EngineCatalog {
  return { crops, silageCrops, animalTypes, constants }
}
