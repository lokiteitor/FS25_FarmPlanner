import { and, asc, eq } from 'drizzle-orm';

import { db, type DbExecutor } from '../db/client';
import { machinery } from '../db/schema';

/**
 * Data access for the `machinery` table (H4.4).
 *
 * Every read/write is scoped by `farmId` so equipment belonging to another farm
 * (and therefore another user, once the farm-scope plugin has authorised the
 * farm) is simply not found — the service maps that to `404 MACHINE_NOT_FOUND`
 * (ADR-005). There is no name uniqueness (docs/base-de-datos.md §12). Per the
 * layering rules all machinery SQL lives here and nowhere else.
 */

export type MachineRow = typeof machinery.$inferSelect;

/** List the machinery of a farm, ordered by name for a stable response. */
export async function listByFarm(
  farmId: string,
  tx: DbExecutor = db,
): Promise<MachineRow[]> {
  return tx
    .select()
    .from(machinery)
    .where(eq(machinery.farmId, farmId))
    .orderBy(asc(machinery.name));
}

/**
 * Find a machine by id scoped to its farm. The `farm_id = farmId` filter is part
 * of the query, so equipment of another farm is not returned (→ 404). Returns
 * `undefined` when no such machine exists in this farm.
 */
export async function findById(
  id: string,
  farmId: string,
  tx: DbExecutor = db,
): Promise<MachineRow | undefined> {
  const rows = await tx
    .select()
    .from(machinery)
    .where(and(eq(machinery.id, id), eq(machinery.farmId, farmId)))
    .limit(1);
  return rows[0];
}

/** Fields to insert for a new machine. */
export interface CreateMachineInput {
  name: string;
  workingWidthM: number;
  workingSpeedKmh: number;
}

/** Create a machine in a farm. */
export async function create(
  farmId: string,
  input: CreateMachineInput,
  tx: DbExecutor = db,
): Promise<MachineRow> {
  const [row] = await tx
    .insert(machinery)
    .values({
      farmId,
      name: input.name,
      workingWidthM: input.workingWidthM,
      workingSpeedKmh: input.workingSpeedKmh,
    })
    .returning();
  return row;
}

/**
 * Partial update of a machine. Only the keys present in `patch` are written, so
 * an absent key leaves its column untouched. Scoped by `farmId` so an id from
 * another farm updates nothing. Returns the updated row, or `undefined` if the
 * id is unknown in this farm.
 */
export interface UpdateMachinePatch {
  name?: string;
  workingWidthM?: number;
  workingSpeedKmh?: number;
}

export async function update(
  id: string,
  farmId: string,
  patch: UpdateMachinePatch,
  tx: DbExecutor = db,
): Promise<MachineRow | undefined> {
  const [row] = await tx
    .update(machinery)
    .set(patch)
    .where(and(eq(machinery.id, id), eq(machinery.farmId, farmId)))
    .returning();
  return row;
}

/**
 * Delete a machine scoped to its farm. Returns true if a row was deleted (false
 * when the id is unknown in this farm). Caller established farm ownership first.
 */
export async function remove(
  id: string,
  farmId: string,
  tx: DbExecutor = db,
): Promise<boolean> {
  const rows = await tx
    .delete(machinery)
    .where(and(eq(machinery.id, id), eq(machinery.farmId, farmId)))
    .returning({ id: machinery.id });
  return rows.length > 0;
}
