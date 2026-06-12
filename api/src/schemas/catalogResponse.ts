/**
 * Zod RESPONSE schemas + row→DTO mappers for the read-only catalog API (H4.1).
 *
 * These materialise the catalog response shapes from docs/openapi.yaml
 * (GameVersion, Crop, SilageCrop, AnimalType, GameConstants) as the single
 * runtime + compile-time serialization contract handed to the routes via
 * fastify-type-provider-zod. They also document those shapes in Swagger.
 *
 * Mappers turn DB rows (snake-ish column names, split animal product columns,
 * KV constant rows) into the camelCase, nested DTOs the contract expects. The
 * repository returns numbers already ({ mode: 'number' }), so mappers only
 * reshape — they don't re-parse numerics.
 *
 * Note on validation strictness: response schemas are intentionally NOT
 * `.strict()`. monthlyRates/feedOptions/game_constants carry heterogeneous,
 * seed-validated JSONB (see src/schemas/catalog.ts and docs/base-de-datos.md §7),
 * so the read path mirrors the OpenAPI `additionalProperties: true` and passes
 * the stored blocks through verbatim.
 */

import { z } from 'zod';

import { animalSpeciesSchema } from './catalog';
import type {
  GameVersionRow,
  CropRow,
  SilageCropWithSlug,
  AnimalTypeRow,
  GameConstantRow,
  ProductionBuildingTypeRow,
  ProductionProductRow,
  ProductionChainRow,
} from '../repositories/catalog.repository';

// ---------------------------------------------------------------------------
// Envelope helper (mirrors dataEnvelope in schemas/auth.ts; redeclared here to
// keep the catalog module self-contained and allow attaching meta per-route).
// ---------------------------------------------------------------------------

/** Wrap a payload schema in the success envelope `{ data }`. */
export function dataEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema });
}

// ---------------------------------------------------------------------------
// Request: shared query for version-scoped catalog endpoints
// ---------------------------------------------------------------------------

/**
 * `?gameVersionId` query for crops/silage-crops/animal-types/constants. Optional
 * — when omitted the active version is served (openapi.yaml GameVersionQuery).
 */
export const gameVersionQuery = z.object({
  gameVersionId: z.string().uuid().optional(),
});

export type GameVersionQuery = z.infer<typeof gameVersionQuery>;

// ---------------------------------------------------------------------------
// GameVersion (openapi.yaml #/components/schemas/GameVersion)
// ---------------------------------------------------------------------------

export const gameVersionSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  isActive: z.boolean(),
  // released_at is a DATE column; drizzle returns it as a "YYYY-MM-DD" string.
  releasedAt: z.string().nullable(),
});

export type GameVersionDto = z.infer<typeof gameVersionSchema>;

export function mapGameVersion(row: GameVersionRow): GameVersionDto {
  return {
    id: row.id,
    label: row.label,
    isActive: row.isActive,
    releasedAt: row.releasedAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Crop (openapi.yaml #/components/schemas/Crop)
// ---------------------------------------------------------------------------

export const cropSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  nameEs: z.string(),
  nameEn: z.string(),
  yieldPerM2: z.number(),
  basePrice: z.number(),
  maxPriceFactor: z.number(),
  seedRate: z.number(),
  weightPerLiter: z.number(),
});

export type CropDto = z.infer<typeof cropSchema>;

export function mapCrop(row: CropRow): CropDto {
  return {
    id: row.id,
    slug: row.slug,
    nameEs: row.nameEs,
    nameEn: row.nameEn,
    yieldPerM2: row.yieldPerM2,
    basePrice: row.basePrice,
    maxPriceFactor: row.maxPriceFactor,
    seedRate: row.seedRate,
    weightPerLiter: row.weightPerLiter,
  };
}

// ---------------------------------------------------------------------------
// SilageCrop (openapi.yaml #/components/schemas/SilageCrop) — incl. cropSlug
// ---------------------------------------------------------------------------

export const silageCropSchema = z.object({
  id: z.string().uuid(),
  cropId: z.string().uuid(),
  cropSlug: z.string(),
  yieldPerM2: z.number(),
  chaffFactor: z.number(),
});

export type SilageCropDto = z.infer<typeof silageCropSchema>;

export function mapSilageCrop(row: SilageCropWithSlug): SilageCropDto {
  return {
    id: row.id,
    cropId: row.cropId,
    cropSlug: row.cropSlug,
    yieldPerM2: row.yieldPerM2,
    chaffFactor: row.chaffFactor,
  };
}

// ---------------------------------------------------------------------------
// AnimalType (openapi.yaml #/components/schemas/AnimalType)
// ---------------------------------------------------------------------------

export const animalProductSchema = z
  .object({
    slug: z.string(),
    basePrice: z.number(),
    priceScalar: z.number().nullable(),
  })
  .nullable();

export const difficultyScalarsSchema = z.object({
  easy: z.number(),
  normal: z.number(),
  hard: z.number(),
});

export const animalTypeSchema = z.object({
  id: z.string().uuid(),
  species: animalSpeciesSchema,
  nameEs: z.string(),
  difficultyScalars: difficultyScalarsSchema,
  salePrice: z.number().nullable(),
  product: animalProductSchema,
  // Monthly rates: heterogeneous keys per species, all numeric.
  monthlyRates: z.record(z.string(), z.number()),
  // Feed options: species-dependent free structure (validated at seed time).
  feedOptions: z.record(z.string(), z.unknown()),
});

export type AnimalTypeDto = z.infer<typeof animalTypeSchema>;

/**
 * Map an animal_types row to the AnimalType DTO.
 *
 * The DB splits the product across columns (product_slug / product_base_price /
 * product_price_scalar) and the difficulty scalars across three columns; the
 * contract nests them. The product is present only when it has a slug AND a base
 * price (cow/buffalo/chicken/sheep/goat); pig/horse have no product → null
 * (docs/base-de-datos.md §7).
 */
export function mapAnimalType(row: AnimalTypeRow): AnimalTypeDto {
  const product =
    row.productSlug !== null && row.productBasePrice !== null
      ? {
          slug: row.productSlug,
          basePrice: row.productBasePrice,
          priceScalar: row.productPriceScalar ?? null,
        }
      : null;

  return {
    id: row.id,
    species: row.species,
    nameEs: row.nameEs,
    difficultyScalars: {
      easy: row.difficultyScalarEasy,
      normal: row.difficultyScalarNormal,
      hard: row.difficultyScalarHard,
    },
    salePrice: row.salePrice ?? null,
    product,
    monthlyRates: row.monthlyRates,
    feedOptions: row.feedOptions,
  };
}

// ---------------------------------------------------------------------------
// GameConstants (openapi.yaml #/components/schemas/GameConstants)
// ---------------------------------------------------------------------------

const milkMonthlyEntrySchema = z.object({
  month: z.number().int(),
  name: z.string(),
  value: z.number(),
});

const milkPriceScalarsSchema = z.object({
  average: z.number(),
  max: z.number(),
  monthly: z.array(milkMonthlyEntrySchema),
});

/**
 * Flattened game_constants (key→value). Every documented constant is optional
 * at the schema level: the response only carries whatever the seed wrote for the
 * version, and `passthrough()` keeps any future constants the seed adds (mirrors
 * the OpenAPI `additionalProperties: true`).
 */
export const gameConstantsSchema = z
  .object({
    defaultYieldBonus: z.number().optional(),
    strawBonus: z.number().optional(),
    mineralFeedPrice: z.number().optional(),
    silagePrice: z.number().optional(),
    silageWeight: z.number().optional(),
    strawYieldPerM2: z.number().optional(),
    grassYieldPerM2: z.number().optional(),
    yieldBonusScalar: z.number().optional(),
    incomeDifficultyScalars: difficultyScalarsSchema.optional(),
    feedPurchasePrices: z.record(z.string(), z.number()).optional(),
    milkPriceScalars: milkPriceScalarsSchema.optional(),
  })
  .passthrough();

export type GameConstantsDto = z.infer<typeof gameConstantsSchema>;

/**
 * snake_case game_constants key → camelCase DTO key. Keeps the flattening
 * explicit and stable instead of relying on a generic snake→camel conversion
 * (so a renamed/added constant is a deliberate change here).
 */
const CONSTANT_KEY_MAP: Record<string, string> = {
  default_yield_bonus: 'defaultYieldBonus',
  straw_bonus: 'strawBonus',
  mineral_feed_price: 'mineralFeedPrice',
  silage_price: 'silagePrice',
  silage_weight: 'silageWeight',
  straw_yield_per_m2: 'strawYieldPerM2',
  grass_yield_per_m2: 'grassYieldPerM2',
  yield_bonus_scalar: 'yieldBonusScalar',
  income_difficulty_scalars: 'incomeDifficultyScalars',
  feed_purchase_prices: 'feedPurchasePrices',
  milk_price_scalars: 'milkPriceScalars',
};

/** Fallback snake_case → camelCase for any constant not in the explicit map. */
function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Flatten game_constants KV rows into the single camelCase GameConstants object.
 * Each row's JSONB `value` (a number or object) becomes the value of its mapped
 * camelCase key.
 */
export function mapGameConstants(rows: GameConstantRow[]): GameConstantsDto {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const camelKey = CONSTANT_KEY_MAP[row.key] ?? snakeToCamel(row.key);
    out[camelKey] = row.value;
  }
  return out as GameConstantsDto;
}

// ---------------------------------------------------------------------------
// ProductionBuildingType (catalog)
// ---------------------------------------------------------------------------

export const productionBuildingTypeSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  nameEs: z.string(),
  nameEn: z.string(),
});

export type ProductionBuildingTypeDto = z.infer<
  typeof productionBuildingTypeSchema
>;

export function mapProductionBuildingType(
  row: ProductionBuildingTypeRow,
): ProductionBuildingTypeDto {
  return { id: row.id, slug: row.slug, nameEs: row.nameEs, nameEn: row.nameEn };
}

// ---------------------------------------------------------------------------
// ProductionProduct (catalog)
// ---------------------------------------------------------------------------

export const productionProductSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  nameEs: z.string(),
  nameEn: z.string(),
});

export type ProductionProductDto = z.infer<typeof productionProductSchema>;

export function mapProductionProduct(
  row: ProductionProductRow,
): ProductionProductDto {
  return { id: row.id, slug: row.slug, nameEs: row.nameEs, nameEn: row.nameEn };
}

// ---------------------------------------------------------------------------
// ProductionChain (catalog)
// ---------------------------------------------------------------------------

const productionIOSchema = z.object({
  slug: z.string(),
  quantityPerCycle: z.number(),
});

export const productionChainSchema = z.object({
  id: z.string().uuid(),
  buildingTypeSlug: z.string(),
  slug: z.string(),
  nameEs: z.string(),
  nameEn: z.string(),
  cyclesPerMonth: z.number(),
  inputs: z.array(productionIOSchema),
  outputs: z.array(productionIOSchema),
});

export type ProductionChainDto = z.infer<typeof productionChainSchema>;

export function mapProductionChain(row: ProductionChainRow): ProductionChainDto {
  return {
    id: row.id,
    buildingTypeSlug: row.buildingTypeSlug,
    slug: row.slug,
    nameEs: row.nameEs,
    nameEn: row.nameEn,
    cyclesPerMonth: row.cyclesPerMonth,
    inputs: row.inputs as { slug: string; quantityPerCycle: number }[],
    outputs: row.outputs as { slug: string; quantityPerCycle: number }[],
  };
}

// ---------------------------------------------------------------------------
// Response envelopes (handed directly to the routes)
// ---------------------------------------------------------------------------

export const gameVersionsResponse = dataEnvelope(z.array(gameVersionSchema));

/** crops carries meta.gameVersionId (the resolved version). */
export const cropsResponse = z.object({
  data: z.array(cropSchema),
  meta: z.object({ gameVersionId: z.string().uuid() }),
});

export const silageCropsResponse = dataEnvelope(z.array(silageCropSchema));
export const animalTypesResponse = dataEnvelope(z.array(animalTypeSchema));
export const constantsResponse = dataEnvelope(gameConstantsSchema);
export const productionBuildingTypesResponse = dataEnvelope(
  z.array(productionBuildingTypeSchema),
);
export const productionProductsResponse = dataEnvelope(
  z.array(productionProductSchema),
);
export const productionChainsResponse = dataEnvelope(
  z.array(productionChainSchema),
);
