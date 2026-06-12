import { and, asc, eq } from 'drizzle-orm';

import { db, type DbExecutor } from '../db/client';
import { productionBuildings } from '../db/schema';
import type { UserChain } from '../db/schema/domain';

/**
 * Data access for the `production_buildings` table.
 *
 * Every read/write is scoped by `farmId` so a building belonging to another
 * farm (another user, once the farm-scope plugin has authorised the farm) is
 * simply not found — the service maps that to 404 PRODUCTION_BUILDING_NOT_FOUND
 * (ADR-005). All SQL lives here and nowhere else.
 */

export type ProductionBuildingRow = typeof productionBuildings.$inferSelect;

/** List the production buildings of a farm, ordered by name. */
export async function listByFarm(
  farmId: string,
  tx: DbExecutor = db,
): Promise<ProductionBuildingRow[]> {
  return tx
    .select()
    .from(productionBuildings)
    .where(eq(productionBuildings.farmId, farmId))
    .orderBy(asc(productionBuildings.name));
}

/**
 * Find a production building by id scoped to its farm. Returns `undefined`
 * when no such building exists in this farm.
 */
export async function findById(
  id: string,
  farmId: string,
  tx: DbExecutor = db,
): Promise<ProductionBuildingRow | undefined> {
  const rows = await tx
    .select()
    .from(productionBuildings)
    .where(
      and(
        eq(productionBuildings.id, id),
        eq(productionBuildings.farmId, farmId),
      ),
    )
    .limit(1);
  return rows[0];
}

export interface CreateProductionBuildingInput {
  name: string;
  buildingTypeSlug: string;
  chains?: UserChain[];
  notes?: string | null;
}

/**
 * Create a production building in a farm. The `production_buildings_farm_name_unique`
 * constraint enforces one-name-per-farm; the service may pre-check and the
 * error-handler maps 23505 to 409 DUPLICATE_PRODUCTION_BUILDING_NAME as a
 * race-safe fallback.
 */
export async function create(
  farmId: string,
  input: CreateProductionBuildingInput,
  tx: DbExecutor = db,
): Promise<ProductionBuildingRow> {
  const [row] = await tx
    .insert(productionBuildings)
    .values({
      farmId,
      name: input.name,
      buildingTypeSlug: input.buildingTypeSlug,
      ...(input.chains !== undefined ? { chains: input.chains } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    })
    .returning();
  return row;
}

export interface UpdateProductionBuildingPatch {
  name?: string;
  buildingTypeSlug?: string;
  chains?: UserChain[];
  notes?: string | null;
}

/**
 * Partial update of a production building. Only present keys are written.
 * Scoped by `farmId`. Returns the updated row, or `undefined` when not found.
 */
export async function update(
  id: string,
  farmId: string,
  patch: UpdateProductionBuildingPatch,
  tx: DbExecutor = db,
): Promise<ProductionBuildingRow | undefined> {
  const [row] = await tx
    .update(productionBuildings)
    .set(patch)
    .where(
      and(
        eq(productionBuildings.id, id),
        eq(productionBuildings.farmId, farmId),
      ),
    )
    .returning();
  return row;
}

/**
 * Delete a production building scoped to its farm. Returns true if a row was
 * deleted; false when the id is unknown in this farm.
 */
export async function remove(
  id: string,
  farmId: string,
  tx: DbExecutor = db,
): Promise<boolean> {
  const rows = await tx
    .delete(productionBuildings)
    .where(
      and(
        eq(productionBuildings.id, id),
        eq(productionBuildings.farmId, farmId),
      ),
    )
    .returning({ id: productionBuildings.id });
  return rows.length > 0;
}
