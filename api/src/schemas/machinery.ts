import { z } from 'zod';

/**
 * Zod schemas for the Machinery module (H4.4).
 *
 * Materialises the `/farms/:farmId/machinery` request/response shapes from
 * docs/openapi.yaml (Machine / MachineCreate / MachineUpdate) as the single
 * runtime + compile-time contract used by the machinery routes
 * (fastify-type-provider-zod).
 *
 * There is NO name uniqueness for machinery (docs/base-de-datos.md §12: a player
 * may keep intentionally duplicated equipment), so this module has no conflict
 * handling — only shape validation and the response contract.
 *
 * Conventions:
 *  - Request bodies are `.strict()` so unknown keys are rejected.
 *  - Width/speed are strictly positive numbers (openapi `exclusiveMinimum: 0`,
 *    mirrored by the DB CHECK constraints).
 *  - Response wrappers use `dataEnvelope(schema)` (docs/arquitectura-api.md §8).
 */

// ---------------------------------------------------------------------------
// Envelope helper (mirrors dataEnvelope elsewhere; redeclared for isolation).
// ---------------------------------------------------------------------------

/** Wrap a payload schema in the success envelope `{ data }`. */
export function dataEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema });
}

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

const nameSchema = z.string().min(1).max(150);
const positiveNumber = z.number().positive();

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

/** POST /farms/:farmId/machinery (openapi.yaml MachineCreate). */
export const machineCreateBody = z
  .object({
    name: nameSchema,
    workingWidthM: positiveNumber,
    workingSpeedKmh: positiveNumber,
  })
  .strict();

/** PATCH /farms/:farmId/machinery/:machineId (openapi.yaml MachineUpdate). */
export const machineUpdateBody = z
  .object({
    name: nameSchema,
    workingWidthM: positiveNumber,
    workingSpeedKmh: positiveNumber,
  })
  .strict()
  .partial();

/** Path params for machinery item routes. */
export const machineParams = z.object({
  farmId: z.string().uuid(),
  machineId: z.string().uuid(),
});

/** Path params for machinery collection routes. */
export const machineCollectionParams = z.object({
  farmId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Response schema (openapi.yaml Machine)
// ---------------------------------------------------------------------------

export const machineSchema = z.object({
  id: z.string().uuid(),
  farmId: z.string().uuid(),
  name: z.string(),
  workingWidthM: z.number(),
  workingSpeedKmh: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MachineDto = z.infer<typeof machineSchema>;

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

export const machineResponse = dataEnvelope(machineSchema);
export const machineryListResponse = dataEnvelope(z.array(machineSchema));

// ---------------------------------------------------------------------------
// Inferred input types
// ---------------------------------------------------------------------------

export type MachineCreateInput = z.infer<typeof machineCreateBody>;
export type MachineUpdateInput = z.infer<typeof machineUpdateBody>;
export type MachineParams = z.infer<typeof machineParams>;
export type MachineCollectionParams = z.infer<typeof machineCollectionParams>;
