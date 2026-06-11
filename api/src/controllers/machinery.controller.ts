/**
 * Machinery controller (H4.4): thin HTTP adapters for `/farms/:farmId/machinery`.
 *
 * Controllers only translate between the request/response cycle and the service:
 * the farm-scope plugin has already authorised the farm and decorated
 * `request.farm`, so handlers read it (asserting it is present — the route wires
 * the hook), pull validated input off `request.body` / `request.params`, invoke
 * the service and wrap the result in the success envelope `{ data }`. No business
 * logic, no DB access — domain errors bubble up to the error-handler plugin.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import * as machineryService from '../services/machinery.service';
import type { FarmRow } from '../repositories/farms.repository';
import type {
  MachineCreateInput,
  MachineUpdateInput,
  MachineParams,
  MachineDto,
} from '../schemas/machinery';

/**
 * Read the farm decorated by the farm-scope hook. The hook runs for every route
 * in this subtree, so `request.farm` is always present here; assert it for TS.
 */
function farmOf(request: FastifyRequest): FarmRow {
  const farm = request.farm;
  if (!farm) {
    // Unreachable when the route is registered under the farm-scope hook.
    throw new Error('farm-scope hook did not run for a machinery route');
  }
  return farm;
}

/** GET /farms/:farmId/machinery → 200 { data: Machine[] }. */
export async function listMachinery(
  request: FastifyRequest,
): Promise<{ data: MachineDto[] }> {
  const data = await machineryService.list(farmOf(request));
  return { data };
}

/** POST /farms/:farmId/machinery → 201 { data: Machine }. */
export async function createMachine(
  request: FastifyRequest<{ Body: MachineCreateInput }>,
  reply: FastifyReply,
): Promise<void> {
  const machine = await machineryService.create(farmOf(request), request.body);
  await reply.status(201).send({ data: machine });
}

/** GET /farms/:farmId/machinery/:machineId → 200 { data: Machine }. */
export async function getMachine(
  request: FastifyRequest<{ Params: MachineParams }>,
): Promise<{ data: MachineDto }> {
  const data = await machineryService.get(
    farmOf(request),
    request.params.machineId,
  );
  return { data };
}

/** PATCH /farms/:farmId/machinery/:machineId → 200 { data: Machine }. */
export async function updateMachine(
  request: FastifyRequest<{ Params: MachineParams; Body: MachineUpdateInput }>,
): Promise<{ data: MachineDto }> {
  const data = await machineryService.update(
    farmOf(request),
    request.params.machineId,
    request.body,
  );
  return { data };
}

/** DELETE /farms/:farmId/machinery/:machineId → 204. */
export async function deleteMachine(
  request: FastifyRequest<{ Params: MachineParams }>,
  reply: FastifyReply,
): Promise<void> {
  await machineryService.remove(farmOf(request), request.params.machineId);
  await reply.status(204).send();
}
