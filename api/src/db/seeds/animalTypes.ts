/**
 * Seed data — animal_types (7) (docs/seeds-catalogo.md §4).
 *
 * Hybrid model (ADR-004): columns for the uniform parts (difficulty scalars,
 * sale price, main product) and JSONB for the heterogeneous blocks
 * (monthly_rates, feed_options).
 *
 * Corrections applied vs the prototype (see §4 / base-de-datos.md §7):
 *  - goat has its OWN difficulty scalars (identical 3.0/1.8/1.0 in v1).
 *  - sale_price: cow 3500, buffalo 3000, pig 2500, horse 5000, sheep 1000,
 *    goat 1000, chicken null.
 *  - product null for pig/horse; priceScalar null for cow/buffalo (they use the
 *    monthly milk price scalars).
 */

import type { AnimalSpecies } from '../schema/enums';

export interface DifficultyScalarsSeed {
  easy: number;
  normal: number;
  hard: number;
}

export interface AnimalProductSeed {
  slug: string;
  basePrice: number;
  priceScalar: number | null;
}

export interface AnimalTypeSeed {
  species: AnimalSpecies;
  nameEs: string;
  difficultyScalars: DifficultyScalarsSeed;
  salePrice: number | null;
  product: AnimalProductSeed | null;
  monthlyRates: Record<string, number>;
  feedOptions: Record<string, unknown>;
}

export const animalTypesSeed: AnimalTypeSeed[] = [
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
];
