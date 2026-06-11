import { z } from 'zod';

/**
 * Zod schemas for the Farms module (H4.2). These materialise the `/farms`
 * request and response shapes from docs/openapi.yaml (FarmCreate, FarmUpdate,
 * Farm, PaginationMeta) as the single runtime + compile-time contract used by
 * the farm routes (fastify-type-provider-zod).
 *
 * Conventions (mirroring src/schemas/auth.ts):
 *  - Request bodies are `.strict()` so unknown keys surface as 422
 *    VALIDATION_ERROR rather than passing silently.
 *  - Response wrappers use `dataEnvelope(schema)` to match the success envelope
 *    `{ data, meta? }` documented in docs/arquitectura-api.md §8.
 *  - `mapName`/`notes` are nullable on update (clients can clear them); on create
 *    they are plain optional strings per the contract.
 */

// ---------------------------------------------------------------------------
// Envelope helper (mirrors dataEnvelope in schemas/auth.ts; redeclared here so
// the farms module is self-contained and can attach meta per-route).
// ---------------------------------------------------------------------------

/** Wrap a payload schema in the success envelope `{ data }`. */
export function dataEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema });
}

// ---------------------------------------------------------------------------
// Shared enums (mirror the PG enums in src/db/schema/enums.ts and the OpenAPI
// Difficulty / SellPriceType components).
// ---------------------------------------------------------------------------

export const difficultySchema = z.enum(['easy', 'normal', 'hard']);
export const sellPriceTypeSchema = z.enum(['baseline', 'max_seasonal']);

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

const farmNameSchema = z.string().min(1).max(100);
const mapNameSchema = z.string().max(100);
const yieldBonusSchema = z.number().min(0).max(5);

// ---------------------------------------------------------------------------
// Request: pagination query (only GET /farms paginates; docs/arquitectura-api.md
// §pagination). page defaults to 1, perPage to 50 (1..200). `z.coerce` turns the
// query string values into numbers before validating.
// ---------------------------------------------------------------------------

export const farmListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
});

export type FarmListQuery = z.infer<typeof farmListQuery>;

// ---------------------------------------------------------------------------
// Request: FarmCreate (openapi.yaml #/components/schemas/FarmCreate)
// Only `name` is required; `gameVersionId` defaults to the active version in the
// service when omitted. Optional columns fall back to their DB defaults.
// ---------------------------------------------------------------------------

export const farmCreateBody = z
  .object({
    name: farmNameSchema,
    gameVersionId: z.string().uuid().optional(),
    mapName: mapNameSchema.optional(),
    difficulty: difficultySchema.optional(),
    defaultYieldBonus: yieldBonusSchema.optional(),
    sellPriceType: sellPriceTypeSchema.optional(),
    notes: z.string().optional(),
  })
  .strict();

export type FarmCreateInput = z.infer<typeof farmCreateBody>;

// ---------------------------------------------------------------------------
// Request: FarmUpdate (openapi.yaml #/components/schemas/FarmUpdate)
// Every field is optional (partial update). `mapName`/`notes` are nullable so a
// client can clear them; changing `gameVersionId` triggers the field-crop remap.
// ---------------------------------------------------------------------------

export const farmUpdateBody = z
  .object({
    name: farmNameSchema.optional(),
    gameVersionId: z.string().uuid().optional(),
    mapName: mapNameSchema.nullable().optional(),
    difficulty: difficultySchema.optional(),
    defaultYieldBonus: yieldBonusSchema.optional(),
    sellPriceType: sellPriceTypeSchema.optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

export type FarmUpdateInput = z.infer<typeof farmUpdateBody>;

// ---------------------------------------------------------------------------
// Request: path params
// ---------------------------------------------------------------------------

export const farmIdParams = z.object({
  farmId: z.string().uuid(),
});

export type FarmIdParams = z.infer<typeof farmIdParams>;

// ---------------------------------------------------------------------------
// Response: Farm (openapi.yaml #/components/schemas/Farm)
// fieldCount/stableCount are derived counters (COUNT), not stored columns
// (docs/base-de-datos.md §9). Timestamps serialise to ISO strings.
// ---------------------------------------------------------------------------

export const farmSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  gameVersionId: z.string().uuid(),
  name: z.string(),
  mapName: z.string().nullable(),
  difficulty: difficultySchema,
  defaultYieldBonus: z.number(),
  sellPriceType: sellPriceTypeSchema,
  notes: z.string().nullable(),
  fieldCount: z.number().int(),
  stableCount: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type FarmDto = z.infer<typeof farmSchema>;

// ---------------------------------------------------------------------------
// Response: pagination meta (openapi.yaml #/components/schemas/PaginationMeta)
// ---------------------------------------------------------------------------

export const paginationMetaSchema = z.object({
  pagination: z.object({
    page: z.number().int(),
    perPage: z.number().int(),
    total: z.number().int(),
  }),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

// ---------------------------------------------------------------------------
// Response envelopes (handed directly to the routes)
// ---------------------------------------------------------------------------

/** GET /farms — list of farms plus pagination meta. */
export const farmListResponse = z.object({
  data: z.array(farmSchema),
  meta: paginationMetaSchema,
});

/** GET /farms/{farmId} and POST /farms — single farm. */
export const farmResponse = dataEnvelope(farmSchema);

/** PATCH /farms/{farmId} — single farm plus optional remap warnings. */
export const farmUpdateResponse = z.object({
  data: farmSchema,
  meta: z
    .object({
      warnings: z.array(z.string()),
    })
    .optional(),
});
