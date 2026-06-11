import { and, asc, eq } from 'drizzle-orm';

import { db, type DbExecutor } from '../db/client';
import { stables } from '../db/schema';
import type { AnimalSpecies } from '../db/schema/enums';

/**
 * Data access for the `stables` table (H4.4).
 *
 * Every read/write is scoped by `farmId` so a stable belonging to another farm
 * (and therefore another user, once the farm-scope plugin has authorised the
 * farm) is simply not found — the service maps that to `404 STABLE_NOT_FOUND`
 * (ADR-005). Per the layering rules all stable SQL lives here and nowhere else.
 */

export type StableRow = typeof stables.$inferSelect;

/** List the stables of a farm, ordered by name for a stable response. */
export async function listByFarm(
  farmId: string,
  tx: DbExecutor = db,
): Promise<StableRow[]> {
  return tx
    .select()
    .from(stables)
    .where(eq(stables.farmId, farmId))
    .orderBy(asc(stables.name));
}

/**
 * Find a stable by id scoped to its farm. The `farm_id = farmId` filter is part
 * of the query, so a stable of another farm is not returned (→ 404). Returns
 * `undefined` when no such stable exists in this farm.
 */
export async function findById(
  id: string,
  farmId: string,
  tx: DbExecutor = db,
): Promise<StableRow | undefined> {
  const rows = await tx
    .select()
    .from(stables)
    .where(and(eq(stables.id, id), eq(stables.farmId, farmId)))
    .limit(1);
  return rows[0];
}

/**
 * Fields to insert for a new stable. `currentCount` and `config` fall back to
 * their DB defaults (0 and `{}`) when omitted. The service validates the config
 * by species and enforces `currentCount <= maxCapacity` before this runs.
 */
export interface CreateStableInput {
  name: string;
  species: AnimalSpecies;
  maxCapacity: number;
  currentCount?: number;
  config?: Record<string, unknown>;
}

/**
 * Create a stable in a farm. The `stables_farm_name_unique` constraint enforces
 * one-name-per-farm; the service may pre-check and the error-handler maps the
 * 23505 to `409 DUPLICATE_STABLE_NAME` as a race-safe fallback.
 */
export async function create(
  farmId: string,
  input: CreateStableInput,
  tx: DbExecutor = db,
): Promise<StableRow> {
  const [row] = await tx
    .insert(stables)
    .values({
      farmId,
      name: input.name,
      species: input.species,
      maxCapacity: input.maxCapacity,
      ...(input.currentCount !== undefined
        ? { currentCount: input.currentCount }
        : {}),
      ...(input.config !== undefined ? { config: input.config } : {}),
    })
    .returning();
  return row;
}

/**
 * Partial update of a stable. Only the keys present in `patch` are written, so an
 * absent key leaves its column untouched. Scoped by `farmId` so an id from
 * another farm updates nothing. Returns the updated row, or `undefined` if the
 * id is unknown in this farm.
 */
export interface UpdateStablePatch {
  name?: string;
  species?: AnimalSpecies;
  maxCapacity?: number;
  currentCount?: number;
  config?: Record<string, unknown>;
}

export async function update(
  id: string,
  farmId: string,
  patch: UpdateStablePatch,
  tx: DbExecutor = db,
): Promise<StableRow | undefined> {
  const [row] = await tx
    .update(stables)
    .set(patch)
    .where(and(eq(stables.id, id), eq(stables.farmId, farmId)))
    .returning();
  return row;
}

/**
 * Delete a stable scoped to its farm. Returns true if a row was deleted (false
 * when the id is unknown in this farm). Caller established farm ownership first.
 */
export async function remove(
  id: string,
  farmId: string,
  tx: DbExecutor = db,
): Promise<boolean> {
  const rows = await tx
    .delete(stables)
    .where(and(eq(stables.id, id), eq(stables.farmId, farmId)))
    .returning({ id: stables.id });
  return rows.length > 0;
}
