/**
 * Zod schemas for the CalculatorStates module (H4.5).
 *
 * Materialises the per-tool persisted state and the CalculatorState response
 * from docs/openapi.yaml (WorkSpeedState + CalculatorState). State is stored per
 * (farm, toolKey); v1 ships a single tool, `work_speed` (docs/base-de-datos.md
 * §14). Extensible to future tools without new tables: add a state schema and
 * map it by `toolKey`.
 *
 * Conventions:
 *  - `workSpeedStateSchema` is `.strict()` so unknown keys are rejected.
 *  - `hectares` and `selectedFieldId` are nullable (the UI may have neither set).
 *  - `efficiency` is constrained to 0.5..1 (the calculator's valid range).
 *  - `activeMachineryIds` references `machinery.id` by UUID; orphan ids are
 *    tolerated on read (the service does not prune them — docs/base-de-datos.md
 *    §14), so the schema only checks the UUID format.
 *  - The response schema is NOT `.strict()`; it passes the validated state
 *    through, mirroring the OpenAPI `CalculatorState.state`.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Tool keys (v1: only `work_speed`)
// ---------------------------------------------------------------------------

/** The supported calculator tool keys. Unknown keys → 422 in the service. */
export const toolKeySchema = z.enum(['work_speed']);

export type ToolKey = z.infer<typeof toolKeySchema>;

// ---------------------------------------------------------------------------
// WorkSpeedState (openapi.yaml #/components/schemas/WorkSpeedState)
// ---------------------------------------------------------------------------

/** Persisted state of the work-speed (work-time) calculator. */
export const workSpeedStateSchema = z
  .object({
    hectares: z.number().nullable().optional(),
    selectedFieldId: z.string().uuid().nullable().optional(),
    efficiency: z.number().min(0.5).max(1),
    activeMachineryIds: z.array(z.string().uuid()),
  })
  .strict();

export type WorkSpeedState = z.infer<typeof workSpeedStateSchema>;

/**
 * State schema keyed by tool. The service looks the toolKey up here to validate
 * the PUT body; an unknown key is rejected before this map is consulted.
 */
export const stateSchemaByTool = {
  work_speed: workSpeedStateSchema,
} as const;

// ---------------------------------------------------------------------------
// Path params
// ---------------------------------------------------------------------------

/** `{farmId}/{toolKey}` path params for the calculator-state routes. */
export const toolKeyParams = z.object({
  farmId: z.string().uuid(),
  toolKey: toolKeySchema,
});

export type ToolKeyParams = z.infer<typeof toolKeyParams>;

// ---------------------------------------------------------------------------
// Response (openapi.yaml #/components/schemas/CalculatorState)
// ---------------------------------------------------------------------------

/**
 * CalculatorState response. `state` is the validated work-speed state; the rest
 * are the persisted columns. Timestamps are ISO strings.
 */
export const calculatorStateSchema = z.object({
  id: z.string().uuid(),
  farmId: z.string().uuid(),
  toolKey: toolKeySchema,
  state: workSpeedStateSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CalculatorStateDto = z.infer<typeof calculatorStateSchema>;

// ---------------------------------------------------------------------------
// Envelope wrapper (handed to the routes)
// ---------------------------------------------------------------------------

/** Wrap a payload schema in the success envelope `{ data }`. */
function dataEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema });
}

/** PUT/GET response body: `{ data: CalculatorState }`. */
export const calculatorStateResponse = dataEnvelope(calculatorStateSchema);

/** PUT body: the WorkSpeedState (openapi.yaml CalculatorStateInput). */
export const calculatorStateInput = workSpeedStateSchema;
