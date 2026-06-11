/**
 * Data access for the `animal_calculator_configs` table (H4.5).
 *
 * One config per (farm, species), enforced by the
 * `animal_configs_farm_species_unique` constraint. The contract exposes these
 * via PUT-as-upsert (no POST), so the central mutation here is {@link upsert},
 * which relies on `ON CONFLICT (farm_id, species) DO UPDATE`. Per the layering
 * rules all SQL for this resource lives here.
 *
 * Ownership is established upstream by the farm-scope plugin; every query is
 * additionally scoped by `farm_id` so a config can never be read or written
 * across farms.
 */

import { and, asc, eq } from 'drizzle-orm';

import { db, type DbExecutor } from '../db/client';
import { animalCalculatorConfigs } from '../db/schema';
import type { AnimalSpecies } from '../db/schema/enums';
import type { AnimalConfigInputs } from '../schemas/animalConfigs';

export type AnimalConfigRow = typeof animalCalculatorConfigs.$inferSelect;

/**
 * List every saved config for a farm, ordered by species for a stable response.
 * Returns 0..7 rows (one per species at most).
 */
export async function listByFarm(
  farmId: string,
  tx: DbExecutor = db,
): Promise<AnimalConfigRow[]> {
  return tx
    .select()
    .from(animalCalculatorConfigs)
    .where(eq(animalCalculatorConfigs.farmId, farmId))
    .orderBy(asc(animalCalculatorConfigs.species));
}

/**
 * Fetch the single config for a (farm, species) pair, or `undefined` if none has
 * been saved (the client then falls back to catalog defaults).
 */
export async function findBySpecies(
  farmId: string,
  species: AnimalSpecies,
  tx: DbExecutor = db,
): Promise<AnimalConfigRow | undefined> {
  const rows = await tx
    .select()
    .from(animalCalculatorConfigs)
    .where(
      and(
        eq(animalCalculatorConfigs.farmId, farmId),
        eq(animalCalculatorConfigs.species, species),
      ),
    )
    .limit(1);
  return rows[0];
}

/** Outcome of an upsert: the row plus whether it was freshly created. */
export interface UpsertResult {
  row: AnimalConfigRow;
  created: boolean;
}

/**
 * Insert or replace the config for a (farm, species) pair (PUT semantics).
 *
 * Uses `ON CONFLICT (farm_id, species) DO UPDATE SET inputs = ...` so concurrent
 * PUTs are race-safe and at most one row exists per pair. The `created` flag is
 * derived by comparing the returned `created_at`/`updated_at`: on a fresh insert
 * the trigger/defaults set them equal; on an update `updated_at` advances. This
 * lets the service answer 201 vs 200 without a prior read.
 */
export async function upsert(
  farmId: string,
  species: AnimalSpecies,
  inputs: AnimalConfigInputs,
  tx: DbExecutor = db,
): Promise<UpsertResult> {
  const [row] = await tx
    .insert(animalCalculatorConfigs)
    .values({
      farmId,
      species,
      inputs,
    })
    .onConflictDoUpdate({
      target: [
        animalCalculatorConfigs.farmId,
        animalCalculatorConfigs.species,
      ],
      set: { inputs },
    })
    .returning();

  const created = row.createdAt.getTime() === row.updatedAt.getTime();
  return { row, created };
}

/**
 * Delete the config for a (farm, species) pair. Returns true if a row was
 * removed (DELETE→back-to-catalog-defaults), false if there was nothing to
 * delete. Caller establishes ownership first via the farm-scope plugin.
 */
export async function remove(
  farmId: string,
  species: AnimalSpecies,
  tx: DbExecutor = db,
): Promise<boolean> {
  const rows = await tx
    .delete(animalCalculatorConfigs)
    .where(
      and(
        eq(animalCalculatorConfigs.farmId, farmId),
        eq(animalCalculatorConfigs.species, species),
      ),
    )
    .returning({ id: animalCalculatorConfigs.id });
  return rows.length > 0;
}
