/**
 * Data access for the `calculator_states` table (H4.5).
 *
 * One state per (farm, tool_key), enforced by the
 * `calculator_states_farm_tool_unique` constraint. The contract exposes these
 * via PUT-as-upsert (no POST, no DELETE in v1), so the central mutation is
 * {@link upsert}, which relies on `ON CONFLICT (farm_id, tool_key) DO UPDATE`.
 * Per the layering rules all SQL for this resource lives here.
 *
 * Ownership is established upstream by the farm-scope plugin; every query is
 * additionally scoped by `farm_id`.
 */

import { and, eq } from 'drizzle-orm';

import { db, type DbExecutor } from '../db/client';
import { calculatorStates } from '../db/schema';
import type { WorkSpeedState } from '../schemas/calculatorStates';

export type CalculatorStateRow = typeof calculatorStates.$inferSelect;

/**
 * Fetch the single state for a (farm, toolKey) pair, or `undefined` if none has
 * been saved (the client then starts from an empty tool).
 */
export async function findByTool(
  farmId: string,
  toolKey: string,
  tx: DbExecutor = db,
): Promise<CalculatorStateRow | undefined> {
  const rows = await tx
    .select()
    .from(calculatorStates)
    .where(
      and(
        eq(calculatorStates.farmId, farmId),
        eq(calculatorStates.toolKey, toolKey),
      ),
    )
    .limit(1);
  return rows[0];
}

/**
 * Insert or replace the state for a (farm, toolKey) pair (PUT semantics).
 *
 * Uses `ON CONFLICT (farm_id, tool_key) DO UPDATE SET state = ...` so concurrent
 * PUTs are race-safe and at most one row exists per pair. Returns the persisted
 * row.
 */
export async function upsert(
  farmId: string,
  toolKey: string,
  state: WorkSpeedState,
  tx: DbExecutor = db,
): Promise<CalculatorStateRow> {
  const [row] = await tx
    .insert(calculatorStates)
    .values({
      farmId,
      toolKey,
      state,
    })
    .onConflictDoUpdate({
      target: [calculatorStates.farmId, calculatorStates.toolKey],
      set: { state },
    })
    .returning();
  return row;
}
