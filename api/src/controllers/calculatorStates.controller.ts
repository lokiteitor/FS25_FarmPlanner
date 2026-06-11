/**
 * CalculatorStates controller (H4.5): thin HTTP adapters for the
 * `/farms/:farmId/calculator-states` routes.
 *
 * Controllers only translate between the request/response cycle and the service:
 * read `request.farm` (set by the farm-scope plugin), the validated path params,
 * and the body, then wrap the result in the success envelope `{ data }`. No
 * business logic, no DB access — domain errors bubble to the error-handler.
 *
 * The PUT body is the tool's state. The route zod-validates it, but the
 * controller forwards the raw `request.body` so the service can re-validate it
 * against the schema selected by `toolKey`.
 *
 * `request.farm` is guaranteed present here because the farm-scope plugin runs as
 * an onRequest hook on this route subtree; the non-null assertion documents that
 * invariant for TypeScript.
 */

import type { FastifyRequest } from 'fastify';

import * as calculatorStatesService from '../services/calculatorStates.service';
import type {
  CalculatorStateDto,
  ToolKeyParams,
} from '../schemas/calculatorStates';

/** GET /farms/{farmId}/calculator-states/{toolKey} → 200 { data: CalculatorState }. */
export async function get(
  request: FastifyRequest<{ Params: ToolKeyParams }>,
): Promise<{ data: CalculatorStateDto }> {
  const state = await calculatorStatesService.get(
    request.farm!,
    request.params.toolKey,
  );
  return { data: state };
}

/** PUT /farms/{farmId}/calculator-states/{toolKey} → 200 { data: CalculatorState }. */
export async function upsert(
  request: FastifyRequest<{ Params: ToolKeyParams }>,
): Promise<{ data: CalculatorStateDto }> {
  const state = await calculatorStatesService.upsert(
    request.farm!,
    request.params.toolKey,
    request.body,
  );
  return { data: state };
}
