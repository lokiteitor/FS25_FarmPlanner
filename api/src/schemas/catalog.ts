import { z } from 'zod';

/**
 * Zod schemas that VALIDATE the heterogeneous JSONB blocks of the game
 * catalogs before they are seeded (`monthly_rates`, `feed_options`, and the
 * `value` of each `game_constants` row).
 *
 * These are the runtime contract the seeder enforces ("seed fails if not
 * valid", per docs/plan-implementacion.md H2.4 and docs/seeds-catalogo.md §
 * "Validación"). They mirror the per-species shapes documented in
 * docs/base-de-datos.md §7 and the OpenAPI AnimalType / GameConstants schemas,
 * and are exported for reuse by the catalog API in H4.
 *
 * Style: strict-ish — only the documented keys are accepted (`.strict()` on
 * fixed-shape objects) so a typo in a seed surfaces as a validation error
 * rather than silently passing through.
 */

// ---------------------------------------------------------------------------
// Species enum (mirrors animal_species in docs/base-de-datos.md §enums)
// ---------------------------------------------------------------------------

export const animalSpeciesSchema = z.enum([
  'cow',
  'buffalo',
  'chicken',
  'sheep',
  'goat',
  'pig',
  'horse',
]);

export type AnimalSpeciesValue = z.infer<typeof animalSpeciesSchema>;

// ---------------------------------------------------------------------------
// monthly_rates — litres/month per animal (negative = consumption).
// Keys differ per species; each species object is strict on its own keys.
// ---------------------------------------------------------------------------

const ruminantMilkRatesSchema = z
  .object({
    milk: z.number(),
    food: z.number(),
    slurry: z.number(),
    manure: z.number(),
    straw: z.number(),
  })
  .strict();

const chickenRatesSchema = z
  .object({
    eggs: z.number(),
    food: z.number(),
  })
  .strict();

const sheepRatesSchema = z
  .object({
    wool: z.number(),
    food: z.number(),
  })
  .strict();

const goatRatesSchema = z
  .object({
    milk: z.number(),
    food: z.number(),
  })
  .strict();

const pigRatesSchema = z
  .object({
    slurry: z.number(),
    manure: z.number(),
    straw: z.number(),
  })
  .strict();

const horseRatesSchema = z
  .object({
    manure: z.number(),
    straw: z.number(),
  })
  .strict();

/**
 * monthly_rates validator keyed by species. cow/buffalo share the milk-ruminant
 * shape (milk/food/slurry/manure/straw); the rest have their own documented
 * keys. The catalog API (H4) re-exposes the rates as `Record<string, number>`,
 * so an additive fallback is also exported for that read path.
 */
export const monthlyRatesBySpecies = {
  cow: ruminantMilkRatesSchema,
  buffalo: ruminantMilkRatesSchema,
  chicken: chickenRatesSchema,
  sheep: sheepRatesSchema,
  goat: goatRatesSchema,
  pig: pigRatesSchema,
  horse: horseRatesSchema,
} as const;

/**
 * Returns the strict monthly_rates schema for a given species.
 */
export function monthlyRatesSchema(
  species: AnimalSpeciesValue,
): z.ZodType<Record<string, number>> {
  return monthlyRatesBySpecies[species];
}

/**
 * Loose monthly_rates schema (any documented numeric record). Used by the
 * read-side API where rates are already trusted in the DB.
 */
export const monthlyRatesRecordSchema = z.record(z.string(), z.number());

export type MonthlyRates = z.infer<typeof monthlyRatesRecordSchema>;

// ---------------------------------------------------------------------------
// feed_options — per-species feeding structure (heterogeneous).
// ---------------------------------------------------------------------------

const cropSlugSchema = z.string().min(1);

/** Productivity factors for ruminant feed modes. cow has `simple`; buffalo not. */
const cowProductivityFactorsSchema = z
  .object({
    tmr: z.number(),
    simple: z.number(),
    hay: z.number(),
    grass: z.number(),
  })
  .strict();

const buffaloProductivityFactorsSchema = z
  .object({
    tmr: z.number(),
    hay: z.number(),
    grass: z.number(),
  })
  .strict();

const tmrRatiosSchema = z
  .object({
    hay: z.number(),
    silage: z.number(),
    straw: z.number(),
    mineralFeed: z.number(),
  })
  .strict();

const cowFeedOptionsSchema = z
  .object({
    productivityFactors: cowProductivityFactorsSchema,
    tmrRatios: tmrRatiosSchema,
    silageCrops: z.array(cropSlugSchema).min(1),
  })
  .strict();

const buffaloFeedOptionsSchema = z
  .object({
    productivityFactors: buffaloProductivityFactorsSchema,
    tmrRatios: tmrRatiosSchema,
    silageCrops: z.array(cropSlugSchema).min(1),
  })
  .strict();

const chickenFeedOptionsSchema = z
  .object({
    boughtFeedTypes: z.array(cropSlugSchema).min(1),
    fieldworkCrops: z.array(cropSlugSchema).min(1),
  })
  .strict();

/**
 * A pig/horse feed component: a monthly litre consumption plus (optionally) the
 * crops admissible for that component. `hay` (horse) has no `crops`.
 */
const feedComponentSchema = z
  .object({
    crops: z.array(cropSlugSchema).min(1).optional(),
    litersPerAnimalMonth: z.number().positive(),
  })
  .strict();

const componentFeedOptionsSchema = z
  .object({
    components: z.record(z.string(), feedComponentSchema),
  })
  .strict();

/** sheep/goat graze; no configurable feed options in v1 ({}). */
const emptyFeedOptionsSchema = z.object({}).strict();

/**
 * feed_options validator keyed by species (see docs/base-de-datos.md §7).
 *  - cow:    productivityFactors (incl. simple) + tmrRatios + silageCrops
 *  - buffalo: same minus `simple`
 *  - chicken: boughtFeedTypes + fieldworkCrops
 *  - pig/horse: components.*{ crops?, litersPerAnimalMonth }
 *  - sheep/goat: {}
 */
export const feedOptionsBySpecies = {
  cow: cowFeedOptionsSchema,
  buffalo: buffaloFeedOptionsSchema,
  chicken: chickenFeedOptionsSchema,
  pig: componentFeedOptionsSchema,
  horse: componentFeedOptionsSchema,
  sheep: emptyFeedOptionsSchema,
  goat: emptyFeedOptionsSchema,
} as const;

/**
 * Returns the strict feed_options schema for a given species.
 */
export function feedOptionsSchema(
  species: AnimalSpeciesValue,
): z.ZodType<Record<string, unknown>> {
  return feedOptionsBySpecies[species] as z.ZodType<Record<string, unknown>>;
}

/**
 * Union of every species' feed_options shape. Useful where the species is not
 * statically known (e.g. validating an arbitrary stored row).
 */
export const feedOptionsUnionSchema = z.union([
  cowFeedOptionsSchema,
  buffaloFeedOptionsSchema,
  chickenFeedOptionsSchema,
  componentFeedOptionsSchema,
  emptyFeedOptionsSchema,
]);

export type FeedOptions = z.infer<typeof feedOptionsUnionSchema>;

// ---------------------------------------------------------------------------
// animal product (column-level, but validated as a block for seeding)
// ---------------------------------------------------------------------------

export const animalProductSchema = z
  .object({
    slug: z.string().min(1),
    basePrice: z.number().nonnegative(),
    priceScalar: z.number().nullable(),
  })
  .strict();

export type AnimalProduct = z.infer<typeof animalProductSchema>;

export const difficultyScalarsSchema = z
  .object({
    easy: z.number().positive(),
    normal: z.number().positive(),
    hard: z.number().positive(),
  })
  .strict();

export type DifficultyScalars = z.infer<typeof difficultyScalarsSchema>;

// ---------------------------------------------------------------------------
// game_constants — value schemas keyed by constant name.
// ---------------------------------------------------------------------------

const milkMonthlyEntrySchema = z
  .object({
    month: z.number().int().min(1).max(12),
    name: z.string().min(1),
    value: z.number(),
  })
  .strict();

export const milkPriceScalarsSchema = z
  .object({
    average: z.number(),
    max: z.number(),
    monthly: z.array(milkMonthlyEntrySchema).length(12),
  })
  .strict();

export type MilkPriceScalars = z.infer<typeof milkPriceScalarsSchema>;

/**
 * Per-key value validators for game_constants. The seeder looks each key up
 * here and fails if a value does not match.
 */
export const gameConstantsValueSchemas = {
  default_yield_bonus: z.number(),
  straw_bonus: z.number(),
  mineral_feed_price: z.number(),
  silage_price: z.number(),
  silage_weight: z.number(),
  straw_yield_per_m2: z.number(),
  grass_yield_per_m2: z.number(),
  income_difficulty_scalars: difficultyScalarsSchema,
  milk_price_scalars: milkPriceScalarsSchema,
  feed_purchase_prices: z.record(z.string(), z.number()),
  yield_bonus_scalar: z.number(),
} as const;

export type GameConstantKey = keyof typeof gameConstantsValueSchemas;

/**
 * Validates a single game_constants value against its keyed schema. Returns the
 * parsed value (throws ZodError if invalid, or Error for an unknown key).
 */
export function parseGameConstantValue(
  key: string,
  value: unknown,
): unknown {
  const schema = (
    gameConstantsValueSchemas as Record<string, z.ZodTypeAny | undefined>
  )[key];
  if (!schema) {
    throw new Error(`Unknown game_constants key: "${key}"`);
  }
  return schema.parse(value);
}
