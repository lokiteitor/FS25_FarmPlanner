/**
 * Zod schemas + row→DTO mapper for the Fields module (H4.3).
 *
 * These materialise the `/farms/{farmId}/fields` request/response shapes from
 * docs/openapi.yaml (Field / FieldCreate / FieldUpdate components) as the single
 * runtime + compile-time contract used by the field routes
 * (fastify-type-provider-zod). They also document those shapes in Swagger.
 *
 * Conventions:
 *  - Request bodies are `.strict()` so unknown keys are rejected (a client typo
 *    surfaces as 422 VALIDATION_ERROR instead of being silently dropped).
 *  - Response wrappers use `dataEnvelope(schema)` to match the success envelope
 *    `{ data, meta? }` documented in docs/arquitectura-api.md §8.
 *  - Validation mirrors the DB CHECK constraints (fields_*) so bad input is a
 *    clean 422 before it ever reaches the database (docs/base-de-datos.md §10):
 *      fieldNumber > 0 integer, hectares > 0, yieldBonus ∈ [0,5], price >= 0.
 *  - `cropId` is a nullable uuid (null = sin asignar). Crop↔version coherence and
 *    the silage-support rule are business rules enforced in the service layer,
 *    not here (they need the farm + catalog).
 */

import { z } from 'zod';

import type { FieldRow } from '../repositories/fields.repository';

// ---------------------------------------------------------------------------
// Envelope helper (mirrors dataEnvelope elsewhere; redeclared so the module is
// self-contained).
// ---------------------------------------------------------------------------

/** Wrap a payload schema in the success envelope `{ data }`. */
export function dataEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema });
}

// ---------------------------------------------------------------------------
// Shared field schemas (match the DB CHECK constraints)
// ---------------------------------------------------------------------------

const fieldNumberSchema = z.number().int().min(1);
const hectaresSchema = z.number().positive();
const cropIdSchema = z.string().uuid().nullable();
const yieldBonusSchema = z.number().min(0).max(5).nullable();
const purchasePriceSchema = z.number().min(0).nullable();

// ---------------------------------------------------------------------------
// Path params
// ---------------------------------------------------------------------------

/** `:fieldId` path param for the detail/update/delete routes. */
export const fieldParams = z.object({
  fieldId: z.string().uuid(),
});

export type FieldParams = z.infer<typeof fieldParams>;

// ---------------------------------------------------------------------------
// Request bodies (openapi.yaml FieldCreate / FieldUpdate)
// ---------------------------------------------------------------------------

/**
 * POST body. `fieldNumber` + `hectares` are required; everything else is
 * optional. `isSilage` defaults to false (matches the column default and the
 * OpenAPI default).
 */
export const fieldCreateBody = z
  .object({
    fieldNumber: fieldNumberSchema,
    hectares: hectaresSchema,
    cropId: cropIdSchema.optional(),
    isSilage: z.boolean().default(false),
    yieldBonus: yieldBonusSchema.optional(),
    purchasePrice: purchasePriceSchema.optional(),
  })
  .strict();

export type FieldCreateInput = z.infer<typeof fieldCreateBody>;

/**
 * PATCH body. Every key is optional (partial update); a present key with `null`
 * clears the column where the contract allows it (cropId/yieldBonus/
 * purchasePrice). `.strict()` rejects unknown keys, and the route layer rejects
 * the empty-object case implicitly via the service (nothing to update is a
 * no-op returning the unchanged row).
 */
export const fieldUpdateBody = z
  .object({
    fieldNumber: fieldNumberSchema.optional(),
    hectares: hectaresSchema.optional(),
    cropId: cropIdSchema.optional(),
    isSilage: z.boolean().optional(),
    yieldBonus: yieldBonusSchema.optional(),
    purchasePrice: purchasePriceSchema.optional(),
  })
  .strict();

export type FieldUpdateInput = z.infer<typeof fieldUpdateBody>;

// ---------------------------------------------------------------------------
// Response (openapi.yaml #/components/schemas/Field)
// ---------------------------------------------------------------------------

export const fieldSchema = z.object({
  id: z.string().uuid(),
  farmId: z.string().uuid(),
  fieldNumber: z.number().int(),
  hectares: z.number(),
  cropId: z.string().uuid().nullable(),
  isSilage: z.boolean(),
  yieldBonus: z.number().nullable(),
  purchasePrice: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type FieldDto = z.infer<typeof fieldSchema>;

/**
 * Map a `fields` row to the Field DTO. Numerics are already `number` (the schema
 * uses `{ mode: 'number' }`); only the timestamps need serialising to ISO
 * strings to satisfy `z.string().datetime()`.
 */
export function mapField(row: FieldRow): FieldDto {
  return {
    id: row.id,
    farmId: row.farmId,
    fieldNumber: row.fieldNumber,
    hectares: row.hectares,
    cropId: row.cropId ?? null,
    isSilage: row.isSilage,
    yieldBonus: row.yieldBonus ?? null,
    purchasePrice: row.purchasePrice ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Response envelopes (handed directly to the routes)
// ---------------------------------------------------------------------------

/** GET /farms/{farmId}/fields → { data: Field[] }. */
export const fieldsListResponse = dataEnvelope(z.array(fieldSchema));

/** GET/POST/PATCH single-field responses → { data: Field }. */
export const fieldResponse = dataEnvelope(fieldSchema);
