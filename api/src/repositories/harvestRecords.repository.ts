/**
 * Data access for the `harvest_records` table.
 *
 * All queries are scoped to a farm (`farm_id = farmId`) so a record belonging
 * to another farm is never returned. Per the layering rules all
 * `harvest_records` SQL lives here.
 */

import { and, desc, eq } from 'drizzle-orm';

import { db, type DbExecutor } from '../db/client';
import { harvestRecords } from '../db/schema';

export type HarvestRecordRow = typeof harvestRecords.$inferSelect;

export interface CreateHarvestInput {
  farmId: string;
  fieldId: string;
  cropId: string | null;
  fieldNumber: number;
  isSilage: boolean;
  actualYieldLiters: number;
  projectedYieldLiters?: number | null;
}

/**
 * Insert a new harvest record. Called atomically inside the `harvest` service
 * together with the field status reset (within the same transaction).
 */
export async function create(
  input: CreateHarvestInput,
  tx: DbExecutor = db,
): Promise<HarvestRecordRow> {
  const [row] = await tx
    .insert(harvestRecords)
    .values({
      farmId: input.farmId,
      fieldId: input.fieldId,
      cropId: input.cropId ?? null,
      fieldNumber: input.fieldNumber,
      isSilage: input.isSilage,
      actualYieldLiters: input.actualYieldLiters,
      projectedYieldLiters: input.projectedYieldLiters ?? null,
    })
    .returning();
  return row;
}

/**
 * List all harvest records of a farm ordered by `harvested_at` descending
 * (most recent first). Used for the farm-level history page.
 */
export async function listByFarm(
  farmId: string,
  tx: DbExecutor = db,
): Promise<HarvestRecordRow[]> {
  return tx
    .select()
    .from(harvestRecords)
    .where(eq(harvestRecords.farmId, farmId))
    .orderBy(desc(harvestRecords.harvestedAt));
}

/**
 * List harvest records for a specific field, scoped to its farm.
 * Ordered by `harvested_at` descending.
 */
export async function listByField(
  farmId: string,
  fieldId: string,
  tx: DbExecutor = db,
): Promise<HarvestRecordRow[]> {
  return tx
    .select()
    .from(harvestRecords)
    .where(
      and(
        eq(harvestRecords.farmId, farmId),
        eq(harvestRecords.fieldId, fieldId),
      ),
    )
    .orderBy(desc(harvestRecords.harvestedAt));
}
