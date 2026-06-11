import { z } from 'zod';

import { animalSpeciesSchema, type AnimalSpeciesValue } from './catalog';

/**
 * Zod schemas for the Stables module (H4.4).
 *
 * Materialises the `/farms/:farmId/stables` request/response shapes from
 * docs/openapi.yaml (Stable / StableCreate / StableUpdate) as the single
 * runtime + compile-time contract used by the stables routes
 * (fastify-type-provider-zod), plus a per-species validator for the `config`
 * JSONB column.
 *
 * Conventions:
 *  - Request bodies are `.strict()` so unknown keys are rejected (a typo in the
 *    client surfaces as 422 VALIDATION_ERROR rather than passing silently).
 *  - The `config` object is validated by species via {@link stableConfigSchema}:
 *    each species accepts only its documented overrides (strict), and the
 *    farm-level keys `difficulty` / `sellPriceType` are explicitly rejected (they
 *    live on the farm, never per stable — docs/openapi.yaml Stable.config).
 *  - Response wrappers use `dataEnvelope(schema)` to match the success envelope
 *    `{ data, meta? }` (docs/arquitectura-api.md §8).
 */

// ---------------------------------------------------------------------------
// Envelope helper (mirrors dataEnvelope elsewhere; redeclared to keep the
// module self-contained).
// ---------------------------------------------------------------------------

/** Wrap a payload schema in the success envelope `{ data }`. */
export function dataEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema });
}

// ---------------------------------------------------------------------------
// config (jsonb) — per-species overrides (openapi.yaml Stable.config)
// ---------------------------------------------------------------------------

/** A crop/silage reference inside config: a non-empty catalog slug. */
const slugSchema = z.string().min(1);

/** Shared override fields, reused across species (all optional). */
const provideStraw = z.boolean();
const grassHarvests = z.number().int().min(0);
const silageCrop = slugSchema.nullable();

/**
 * Ruminant feed modes. Cow supports the full set; buffalo has no `simple`
 * (docs/base-de-datos.md §7 / openapi.yaml BuffaloInputs).
 */
const cowFeedType = z.enum(['tmr', 'simple', 'hay', 'grass']);
const buffaloFeedType = z.enum(['tmr', 'hay', 'grass']);

/**
 * Per-species `config` schemas. Each is `.strict()` so only the documented
 * overrides are accepted; in particular `difficulty` and `sellPriceType` are
 * NOT present here and therefore rejected (they belong to the farm).
 */
const cowConfigSchema = z
  .object({
    feedType: cowFeedType.optional(),
    provideStraw: provideStraw.optional(),
    grassHarvests: grassHarvests.optional(),
    silageCrop: silageCrop.optional(),
  })
  .strict();

const buffaloConfigSchema = z
  .object({
    feedType: buffaloFeedType.optional(),
    provideStraw: provideStraw.optional(),
    grassHarvests: grassHarvests.optional(),
    silageCrop: silageCrop.optional(),
  })
  .strict();

/** Chickens are fed via the calculator, not the stable config; no overrides. */
const chickenConfigSchema = z.object({}).strict();

/** Sheep/goat graze: only the number of grass harvests is configurable. */
const grazerConfigSchema = z
  .object({
    grassHarvests: grassHarvests.optional(),
  })
  .strict();

/** Pigs: straw + the four feed component crops (base/grain/protein/root). */
const pigConfigSchema = z
  .object({
    provideStraw: provideStraw.optional(),
    baseCrop: slugSchema.optional(),
    grainCrop: slugSchema.optional(),
    proteinCrop: slugSchema.optional(),
    rootCrop: slugSchema.optional(),
  })
  .strict();

/** Horses: straw + hay (grassHarvests) + base/root feed component crops. */
const horseConfigSchema = z
  .object({
    provideStraw: provideStraw.optional(),
    grassHarvests: grassHarvests.optional(),
    baseCrop: slugSchema.optional(),
    rootCrop: slugSchema.optional(),
  })
  .strict();

/** Per-species `config` validator table. */
const configBySpecies = {
  cow: cowConfigSchema,
  buffalo: buffaloConfigSchema,
  chicken: chickenConfigSchema,
  sheep: grazerConfigSchema,
  goat: grazerConfigSchema,
  pig: pigConfigSchema,
  horse: horseConfigSchema,
} as const;

/**
 * Returns the strict `config` zod schema for a given species. The service uses
 * it to validate (and re-validate on PATCH) the stable `config` JSONB against the
 * stable's species; unknown keys and the farm-level `difficulty`/`sellPriceType`
 * keys are rejected.
 */
export function stableConfigSchema(
  species: AnimalSpeciesValue,
): z.ZodType<Record<string, unknown>> {
  return configBySpecies[species] as z.ZodType<Record<string, unknown>>;
}

/**
 * The set of config slug references for a parsed config, used by the service to
 * validate them against the farm's catalog version. Returns `{ key, slug }`
 * pairs (so an invalid slug can be reported on the right field).
 */
export interface ConfigSlugRef {
  key: string;
  slug: string;
}

/** Keys whose value is a single crop/silage slug reference. */
const SLUG_REF_KEYS = [
  'silageCrop',
  'baseCrop',
  'grainCrop',
  'proteinCrop',
  'rootCrop',
] as const;

/**
 * Extract the slug references present in a parsed `config` so the service can
 * check them against the farm's catalog. `null` (explicitly cleared) is skipped.
 */
export function configSlugRefs(config: Record<string, unknown>): ConfigSlugRef[] {
  const refs: ConfigSlugRef[] = [];
  for (const key of SLUG_REF_KEYS) {
    const value = config[key];
    if (typeof value === 'string' && value.length > 0) {
      refs.push({ key, slug: value });
    }
  }
  return refs;
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

/**
 * The raw `config` shape accepted at the schema layer: any JSON object. The
 * species-specific validation happens in the service via {@link stableConfigSchema}
 * (the route schema cannot know the species' strict shape ahead of time, and the
 * contract documents `config` as a free object — additionalProperties: true).
 */
const rawConfigSchema = z.record(z.string(), z.unknown());

/** POST /farms/:farmId/stables (openapi.yaml StableCreate). */
export const stableCreateBody = z
  .object({
    name: z.string().min(1).max(100),
    species: animalSpeciesSchema,
    maxCapacity: z.number().int().min(1),
    currentCount: z.number().int().min(0).default(0),
    config: rawConfigSchema.optional(),
  })
  .strict();

/** PATCH /farms/:farmId/stables/:stableId (openapi.yaml StableUpdate). */
export const stableUpdateBody = z
  .object({
    name: z.string().min(1).max(100),
    species: animalSpeciesSchema,
    maxCapacity: z.number().int().min(1),
    currentCount: z.number().int().min(0),
    config: rawConfigSchema,
  })
  .strict()
  .partial();

/** Path params for stable item routes. */
export const stableParams = z.object({
  farmId: z.string().uuid(),
  stableId: z.string().uuid(),
});

/** Path params for stable collection routes. */
export const stableCollectionParams = z.object({
  farmId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Response schema (openapi.yaml Stable)
// ---------------------------------------------------------------------------

export const stableSchema = z.object({
  id: z.string().uuid(),
  farmId: z.string().uuid(),
  name: z.string(),
  species: animalSpeciesSchema,
  maxCapacity: z.number().int(),
  currentCount: z.number().int(),
  // config is heterogeneous per species; the read path passes it through.
  config: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type StableDto = z.infer<typeof stableSchema>;

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

export const stableResponse = dataEnvelope(stableSchema);
export const stablesListResponse = dataEnvelope(z.array(stableSchema));

// ---------------------------------------------------------------------------
// Inferred input types
// ---------------------------------------------------------------------------

export type StableCreateInput = z.infer<typeof stableCreateBody>;
export type StableUpdateInput = z.infer<typeof stableUpdateBody>;
export type StableParams = z.infer<typeof stableParams>;
export type StableCollectionParams = z.infer<typeof stableCollectionParams>;
