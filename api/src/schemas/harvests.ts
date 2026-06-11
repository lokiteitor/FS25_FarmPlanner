/**
 * Zod schemas + row→DTO mapper for the Harvests module.
 *
 * Covers two surfaces:
 *  - `POST /farms/:farmId/fields/:fieldId/harvest` — the client submits the
 *    actual yield; optionally also the projected yield (computed client-side
 *    by the engine) for comparison storage.
 *  - `GET /farms/:farmId/harvests` — list of all harvest records for the farm.
 *
 * Conventions follow the same patterns as schemas/fields.ts: strict() bodies,
 * dataEnvelope wrappers, ISO timestamp strings in responses.
 */

import { z } from 'zod';
import type { HarvestRecordRow } from '../repositories/harvestRecords.repository';

// ---------------------------------------------------------------------------
// Envelope helper (identical to the one in schemas/fields.ts)
// ---------------------------------------------------------------------------

function dataEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema });
}

// ---------------------------------------------------------------------------
// Request body — POST /:fieldId/harvest
// ---------------------------------------------------------------------------

export const harvestBody = z
  .object({
    /** Litros reales cosechados, reportados por el usuario. Debe ser ≥ 0. */
    actualYieldLiters: z.number().min(0, 'El rendimiento no puede ser negativo'),
    /**
     * Litros proyectados por el motor de cálculo en el momento de la cosecha.
     * Calculado en el cliente y enviado opcionalmente para el comparativo.
     * Null si el campo no tenía proyección disponible.
     */
    projectedYieldLiters: z.number().min(0).nullable().optional(),
  })
  .strict();

export type HarvestInput = z.infer<typeof harvestBody>;

// ---------------------------------------------------------------------------
// Response (GET /farms/:farmId/harvests items)
// ---------------------------------------------------------------------------

export const harvestRecordSchema = z.object({
  id: z.string().uuid(),
  farmId: z.string().uuid(),
  fieldId: z.string().uuid(),
  cropId: z.string().uuid().nullable(),
  /** Snapshot of the field number at harvest time (stable even if field changes). */
  fieldNumber: z.number().int(),
  isSilage: z.boolean(),
  actualYieldLiters: z.number(),
  projectedYieldLiters: z.number().nullable(),
  harvestedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export type HarvestRecordDto = z.infer<typeof harvestRecordSchema>;

/** Map a `harvest_records` row to the HarvestRecord DTO. */
export function mapHarvest(row: HarvestRecordRow): HarvestRecordDto {
  return {
    id: row.id,
    farmId: row.farmId,
    fieldId: row.fieldId,
    cropId: row.cropId ?? null,
    fieldNumber: row.fieldNumber,
    isSilage: row.isSilage,
    actualYieldLiters: row.actualYieldLiters,
    projectedYieldLiters: row.projectedYieldLiters ?? null,
    harvestedAt: row.harvestedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

/** GET /farms/:farmId/harvests → { data: HarvestRecord[] }. */
export const harvestsListResponse = dataEnvelope(z.array(harvestRecordSchema));
