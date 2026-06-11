/**
 * Stables controller (H4.4): thin HTTP adapters for `/farms/:farmId/stables`.
 *
 * Controllers only translate between the request/response cycle and the service:
 * the farm-scope plugin has already authorised the farm and decorated
 * `request.farm`, so handlers read it (asserting it is present — the route wires
 * the hook), pull validated input off `request.body` / `request.params`, invoke
 * the service and wrap the result in the success envelope `{ data }`. No business
 * logic, no DB access — domain errors bubble up to the error-handler plugin.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import * as stablesService from '../services/stables.service';
import type { FarmRow } from '../repositories/farms.repository';
import type {
  StableCreateInput,
  StableUpdateInput,
  StableParams,
  StableDto,
} from '../schemas/stables';

/**
 * Read the farm decorated by the farm-scope hook. The hook runs for every route
 * in this subtree, so `request.farm` is always present here; assert it for TS.
 */
function farmOf(request: FastifyRequest): FarmRow {
  const farm = request.farm;
  if (!farm) {
    // Unreachable when the route is registered under the farm-scope hook.
    throw new Error('farm-scope hook did not run for a stables route');
  }
  return farm;
}

/** GET /farms/:farmId/stables → 200 { data: Stable[] }. */
export async function listStables(
  request: FastifyRequest,
): Promise<{ data: StableDto[] }> {
  const data = await stablesService.list(farmOf(request));
  return { data };
}

/** POST /farms/:farmId/stables → 201 { data: Stable }. */
export async function createStable(
  request: FastifyRequest<{ Body: StableCreateInput }>,
  reply: FastifyReply,
): Promise<void> {
  const stable = await stablesService.create(farmOf(request), request.body);
  await reply.status(201).send({ data: stable });
}

/** GET /farms/:farmId/stables/:stableId → 200 { data: Stable }. */
export async function getStable(
  request: FastifyRequest<{ Params: StableParams }>,
): Promise<{ data: StableDto }> {
  const data = await stablesService.get(farmOf(request), request.params.stableId);
  return { data };
}

/** PATCH /farms/:farmId/stables/:stableId → 200 { data: Stable }. */
export async function updateStable(
  request: FastifyRequest<{ Params: StableParams; Body: StableUpdateInput }>,
): Promise<{ data: StableDto }> {
  const data = await stablesService.update(
    farmOf(request),
    request.params.stableId,
    request.body,
  );
  return { data };
}

/** DELETE /farms/:farmId/stables/:stableId → 204. */
export async function deleteStable(
  request: FastifyRequest<{ Params: StableParams }>,
  reply: FastifyReply,
): Promise<void> {
  await stablesService.remove(farmOf(request), request.params.stableId);
  await reply.status(204).send();
}
