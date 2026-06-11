/**
 * CalculatorStates service (H4.5): business logic for per-tool persisted state,
 * one row per (farm, toolKey).
 *
 * Responsibilities and boundaries:
 *  - Orchestrates the calculatorStates repository; ALL DB access goes through
 *    repositories (layered architecture).
 *  - Ownership is already enforced by the farm-scope plugin (caller passes the
 *    resolved `farm`); every repository call is scoped by `farm.id`.
 *  - `toolKey` must be a known tool (`work_speed` in v1); anything else → 422
 *    VALIDATION_ERROR. The route's zod enum already enforces this, but the
 *    service re-checks so it is safe in isolation and so a future tool addition
 *    has one validation choke point.
 *  - The PUT body (state) is validated by the schema mapped to `toolKey`.
 *  - Orphan `activeMachineryIds` (referencing deleted machinery) are tolerated:
 *    they are NOT pruned on read or write (docs/base-de-datos.md §14).
 *  - Maps rows to the CalculatorState DTO (timestamps as ISO strings).
 *
 * Throws domain {@link AppError}s; the error-handler plugin formats them.
 */

import { ValidationError, NotFoundError } from '../lib/errors';
import type { ErrorDetail } from '../lib/errors';
import type { FarmRow } from '../repositories/farms.repository';
import * as calculatorStatesRepo from '../repositories/calculatorStates.repository';
import type { CalculatorStateRow } from '../repositories/calculatorStates.repository';
import {
  stateSchemaByTool,
  toolKeySchema,
  type CalculatorStateDto,
  type ToolKey,
  type WorkSpeedState,
} from '../schemas/calculatorStates';

/** Map a persisted row to the CalculatorState DTO (timestamps → ISO strings). */
function toDto(row: CalculatorStateRow): CalculatorStateDto {
  return {
    id: row.id,
    farmId: row.farmId,
    // `tool_key` is a free varchar in the DB; rows are only ever written through
    // this service with a validated key, so the cast is safe.
    toolKey: row.toolKey as ToolKey,
    // `state` was validated by the tool's schema on write.
    state: row.state as WorkSpeedState,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Narrow an arbitrary string to a known `ToolKey`, throwing 422 VALIDATION_ERROR
 * otherwise. The route already validates the path enum; this guards the service.
 */
function assertToolKey(toolKey: string): ToolKey {
  const parsed = toolKeySchema.safeParse(toolKey);
  if (!parsed.success) {
    throw new ValidationError([
      { path: 'toolKey', message: `Unknown calculator tool "${toolKey}"` },
    ]);
  }
  return parsed.data;
}

/**
 * GET /farms/{farmId}/calculator-states/{toolKey} → the saved state, or
 * `404 CALCULATOR_STATE_NOT_FOUND` when none exists.
 *
 * Orphan `activeMachineryIds` are passed through verbatim (tolerated on read).
 */
export async function get(
  farm: FarmRow,
  toolKey: string,
): Promise<CalculatorStateDto> {
  const key = assertToolKey(toolKey);

  const row = await calculatorStatesRepo.findByTool(farm.id, key);
  if (!row) {
    throw new NotFoundError(
      'CALCULATOR_STATE_NOT_FOUND',
      'No saved state for this tool',
    );
  }
  return toDto(row);
}

/**
 * PUT /farms/{farmId}/calculator-states/{toolKey} — create or replace the state.
 *
 * Steps:
 *  1. Narrow `toolKey` to a known tool → 422 VALIDATION_ERROR otherwise.
 *  2. Validate the body against the schema for that tool → 422 VALIDATION_ERROR.
 *  3. Upsert and return the persisted DTO. (The contract returns 200 for both
 *     create and replace, so no created/200-vs-201 distinction is needed.)
 */
export async function upsert(
  farm: FarmRow,
  toolKey: string,
  body: unknown,
): Promise<CalculatorStateDto> {
  const key = assertToolKey(toolKey);

  const stateSchema = stateSchemaByTool[key];
  const parsed = stateSchema.safeParse(body);
  if (!parsed.success) {
    const details: ErrorDetail[] = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError(details);
  }

  const row = await calculatorStatesRepo.upsert(farm.id, key, parsed.data);
  return toDto(row);
}
