/**
 * Production Buildings controller: thin HTTP adapters for
 * `/farms/:farmId/production-buildings`.
 *
 * Controllers only translate between the request/response cycle and the
 * service: the farm-scope plugin has already authorised the farm and decorated
 * `request.farm`, so handlers pull validated input off `request.body` /
 * `request.params`, invoke the service and wrap the result in `{ data }`.
 * No business logic, no DB access — domain errors bubble up to the
 * error-handler plugin.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import * as buildingsService from '../services/productionBuildings.service';
import type { FarmRow } from '../repositories/farms.repository';
import type {
  ProductionBuildingCreateInput,
  ProductionBuildingUpdateInput,
  ProductionBuildingParams,
  ProductionBuildingDto,
} from '../schemas/productionBuildings';

function farmOf(request: FastifyRequest): FarmRow {
  const farm = request.farm;
  if (!farm) {
    throw new Error(
      'farm-scope hook did not run for a production-buildings route',
    );
  }
  return farm;
}

/** GET /farms/:farmId/production-buildings → 200 { data: ProductionBuilding[] }. */
export async function listBuildings(
  request: FastifyRequest,
): Promise<{ data: ProductionBuildingDto[] }> {
  const data = await buildingsService.list(farmOf(request));
  return { data };
}

/** POST /farms/:farmId/production-buildings → 201 { data: ProductionBuilding }. */
export async function createBuilding(
  request: FastifyRequest<{ Body: ProductionBuildingCreateInput }>,
  reply: FastifyReply,
): Promise<void> {
  const building = await buildingsService.create(farmOf(request), request.body);
  await reply.status(201).send({ data: building });
}

/** GET /farms/:farmId/production-buildings/:buildingId → 200 { data: ProductionBuilding }. */
export async function getBuilding(
  request: FastifyRequest<{ Params: ProductionBuildingParams }>,
): Promise<{ data: ProductionBuildingDto }> {
  const data = await buildingsService.get(
    farmOf(request),
    request.params.buildingId,
  );
  return { data };
}

/** PATCH /farms/:farmId/production-buildings/:buildingId → 200 { data: ProductionBuilding }. */
export async function updateBuilding(
  request: FastifyRequest<{
    Params: ProductionBuildingParams;
    Body: ProductionBuildingUpdateInput;
  }>,
): Promise<{ data: ProductionBuildingDto }> {
  const data = await buildingsService.update(
    farmOf(request),
    request.params.buildingId,
    request.body,
  );
  return { data };
}

/** DELETE /farms/:farmId/production-buildings/:buildingId → 204. */
export async function deleteBuilding(
  request: FastifyRequest<{ Params: ProductionBuildingParams }>,
  reply: FastifyReply,
): Promise<void> {
  await buildingsService.remove(farmOf(request), request.params.buildingId);
  await reply.status(204).send();
}
