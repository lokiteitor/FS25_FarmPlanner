/**
 * Zod schemas for the AnimalConfigs module (H4.5).
 *
 * Materialises the per-species calculator `inputs` discriminated union and the
 * AnimalConfig response shape from docs/openapi.yaml (CowInputs / BuffaloInputs /
 * ChickenInputs / SheepInputs / GoatInputs / PigInputs / HorseInputs +
 * AnimalConfig). One config exists per (farm, species); the body is the `inputs`
 * object, validated by species (ADR-003, docs/base-de-datos.md §13).
 *
 * Conventions:
 *  - Every species object is `.strict()` so unknown keys are rejected — this is
 *    the runtime enforcement of the OpenAPI `additionalProperties: false`. In
 *    particular `difficulty` and `sellPriceType` are NOT accepted here: they live
 *    on the farm, never duplicated in a config (docs/base-de-datos.md §13).
 *  - The union discriminates on `species`, so the route's `{species}` path param
 *    selects the expected member; the service additionally checks body.species
 *    equals the path (else 422 VALIDATION_ERROR).
 *  - Common fields on every species: `species` (const discriminant),
 *    `count` (int >= 0), optional `yieldBonus` (0..5), optional `linkedStableId`
 *    (uuid | null).
 *  - Crop/silage fields are slugs (strings); they are validated against the
 *    farm's catalog in the service, not here.
 *  - The response schema is intentionally NOT `.strict()`: `inputs` is passed
 *    through as the validated union, mirroring the OpenAPI `AnimalConfigInputs`.
 */

import { z } from 'zod';

import { animalSpeciesSchema } from './catalog';

// ---------------------------------------------------------------------------
// Shared field schemas (common to every species)
// ---------------------------------------------------------------------------

const countSchema = z.number().int().min(0);
const yieldBonusSchema = z.number().min(0).max(5);
const linkedStableIdSchema = z.string().uuid().nullable();
/** Crop/silage references are stored as slugs (non-empty strings). */
const cropSlugSchema = z.string().min(1);
const sellCountSchema = z.number().int().min(0);
const grassHarvestsSchema = z.number().int().min(0);
const provideStrawSchema = z.boolean();

// ---------------------------------------------------------------------------
// Per-species inputs (each `.strict()`; discriminated on `species`)
// ---------------------------------------------------------------------------

/** CowInputs (openapi.yaml #/components/schemas/CowInputs). */
export const cowInputsSchema = z
  .object({
    species: z.literal('cow'),
    count: countSchema,
    yieldBonus: yieldBonusSchema.optional(),
    linkedStableId: linkedStableIdSchema.optional(),
    feedType: z.enum(['tmr', 'simple', 'hay', 'grass']).optional(),
    provideStraw: provideStrawSchema.optional(),
    grassHarvests: grassHarvestsSchema.optional(),
    silageCrop: cropSlugSchema.nullable().optional(),
    sellCount: sellCountSchema.optional(),
    breed: z.enum(['Holstein', 'Other']).optional(),
  })
  .strict();

/** BuffaloInputs — no `simple` feedType (only tmr/hay/grass). */
export const buffaloInputsSchema = z
  .object({
    species: z.literal('buffalo'),
    count: countSchema,
    yieldBonus: yieldBonusSchema.optional(),
    linkedStableId: linkedStableIdSchema.optional(),
    feedType: z.enum(['tmr', 'hay', 'grass']).optional(),
    provideStraw: provideStrawSchema.optional(),
    grassHarvests: grassHarvestsSchema.optional(),
    silageCrop: cropSlugSchema.nullable().optional(),
    sellCount: sellCountSchema.optional(),
  })
  .strict();

/** ChickenInputs — bought-feed percentage + grown crop. */
export const chickenInputsSchema = z
  .object({
    species: z.literal('chicken'),
    count: countSchema,
    yieldBonus: yieldBonusSchema.optional(),
    linkedStableId: linkedStableIdSchema.optional(),
    boughtFeedPercent: z.number().min(0).max(100).optional(),
    boughtFeedType: z.enum(['oat', 'wheat']).optional(),
    grownCrop: cropSlugSchema.optional(),
  })
  .strict();

/** SheepInputs — grazes (grassHarvests) and is sellable (sellCount). */
export const sheepInputsSchema = z
  .object({
    species: z.literal('sheep'),
    count: countSchema,
    yieldBonus: yieldBonusSchema.optional(),
    linkedStableId: linkedStableIdSchema.optional(),
    grassHarvests: grassHarvestsSchema.optional(),
    sellCount: sellCountSchema.optional(),
  })
  .strict();

/** GoatInputs — grazes (grassHarvests) and is sellable (sellCount). */
export const goatInputsSchema = z
  .object({
    species: z.literal('goat'),
    count: countSchema,
    yieldBonus: yieldBonusSchema.optional(),
    linkedStableId: linkedStableIdSchema.optional(),
    grassHarvests: grassHarvestsSchema.optional(),
    sellCount: sellCountSchema.optional(),
  })
  .strict();

/** PigInputs — straw + the four feed components (base/grain/protein/root). */
export const pigInputsSchema = z
  .object({
    species: z.literal('pig'),
    count: countSchema,
    yieldBonus: yieldBonusSchema.optional(),
    linkedStableId: linkedStableIdSchema.optional(),
    provideStraw: provideStrawSchema.optional(),
    sellCount: sellCountSchema.optional(),
    baseCrop: cropSlugSchema.optional(),
    grainCrop: cropSlugSchema.optional(),
    proteinCrop: cropSlugSchema.optional(),
    rootCrop: cropSlugSchema.optional(),
  })
  .strict();

/** HorseInputs — straw + hay (grassHarvests) + base/root crops; sellable. */
export const horseInputsSchema = z
  .object({
    species: z.literal('horse'),
    count: countSchema,
    yieldBonus: yieldBonusSchema.optional(),
    linkedStableId: linkedStableIdSchema.optional(),
    provideStraw: provideStrawSchema.optional(),
    grassHarvests: grassHarvestsSchema.optional(),
    sellCount: sellCountSchema.optional(),
    baseCrop: cropSlugSchema.optional(),
    rootCrop: cropSlugSchema.optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Discriminated union (openapi.yaml #/components/schemas/AnimalConfigInputs)
// ---------------------------------------------------------------------------

/**
 * The calculator `inputs`, discriminated on `species`. This is the PUT body
 * schema; the route's `{species}` selects the member, and the service rejects a
 * body whose `species` differs from the path (422 VALIDATION_ERROR).
 */
export const animalConfigInputsSchema = z.discriminatedUnion('species', [
  cowInputsSchema,
  buffaloInputsSchema,
  chickenInputsSchema,
  sheepInputsSchema,
  goatInputsSchema,
  pigInputsSchema,
  horseInputsSchema,
]);

export type AnimalConfigInputs = z.infer<typeof animalConfigInputsSchema>;

// ---------------------------------------------------------------------------
// Path params
// ---------------------------------------------------------------------------

/** `{farmId}` path param shared by the farm-scoped routes. */
export const farmIdParams = z.object({
  farmId: z.string().uuid(),
});

/** `{farmId}/{species}` path params for the per-species routes. */
export const speciesParams = z.object({
  farmId: z.string().uuid(),
  species: animalSpeciesSchema,
});

export type SpeciesParams = z.infer<typeof speciesParams>;

// ---------------------------------------------------------------------------
// Response (openapi.yaml #/components/schemas/AnimalConfig)
// ---------------------------------------------------------------------------

/**
 * AnimalConfig response. `inputs` is the validated union; the rest are the
 * persisted columns (docs/base-de-datos.md §13). Timestamps are ISO strings.
 */
export const animalConfigSchema = z.object({
  id: z.string().uuid(),
  farmId: z.string().uuid(),
  species: animalSpeciesSchema,
  schemaVersion: z.number().int(),
  inputs: animalConfigInputsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AnimalConfigDto = z.infer<typeof animalConfigSchema>;

// ---------------------------------------------------------------------------
// Envelope wrappers (handed to the routes)
// ---------------------------------------------------------------------------

/** Wrap a payload schema in the success envelope `{ data }`. */
function dataEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema });
}

export const animalConfigResponse = dataEnvelope(animalConfigSchema);
export const animalConfigListResponse = dataEnvelope(
  z.array(animalConfigSchema),
);
