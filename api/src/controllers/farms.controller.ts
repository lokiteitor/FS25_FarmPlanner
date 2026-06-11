/**
 * Farms controller (H4.2): thin HTTP adapters for the `/farms` routes.
 *
 * Controllers only translate between the request/response cycle and the service
 * layer: pull validated input off `request.query`/`request.body`/`request.user`,
 * call the service, and wrap the result in the success envelope `{ data, meta? }`
 * (docs/arquitectura-api.md §8). No business logic, no DB access, no error
 * handling — domain errors bubble up to the error-handler plugin.
 *
 * Handlers that just return a value let the route's zod response serializer run;
 * 201/204 status-only responses drive the reply directly.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import * as farmsService from '../services/farms.service';
import type { FarmDto, PaginationMeta } from '../schemas/farms';
import type {
  FarmCreateInput,
  FarmIdParams,
  FarmListQuery,
  FarmUpdateInput,
} from '../schemas/farms';

/** GET /farms → 200 { data: Farm[], meta: { pagination } }. */
export async function listFarms(
  request: FastifyRequest<{ Querystring: FarmListQuery }>,
): Promise<{ data: FarmDto[]; meta: PaginationMeta }> {
  const { page, perPage } = request.query;
  const { farms, total } = await farmsService.list(
    request.user.id,
    page,
    perPage,
  );
  return { data: farms, meta: { pagination: { page, perPage, total } } };
}

/** GET /farms/{farmId} → 200 { data: Farm }. */
export async function getFarm(
  request: FastifyRequest<{ Params: FarmIdParams }>,
): Promise<{ data: FarmDto }> {
  const farm = await farmsService.get(request.user.id, request.params.farmId);
  return { data: farm };
}

/** POST /farms → 201 { data: Farm }. */
export async function createFarm(
  request: FastifyRequest<{ Body: FarmCreateInput }>,
  reply: FastifyReply,
): Promise<void> {
  const farm = await farmsService.create(request.user.id, request.body);
  await reply.status(201).send({ data: farm });
}

/**
 * PATCH /farms/{farmId} → 200 { data: Farm, meta?: { warnings } }.
 *
 * `meta.warnings` is attached only when the version-change remap produced
 * non-empty warnings, so unchanged-version updates stay clean.
 */
export async function updateFarm(
  request: FastifyRequest<{ Params: FarmIdParams; Body: FarmUpdateInput }>,
): Promise<{ data: FarmDto; meta?: { warnings: string[] } }> {
  const { farm, warnings } = await farmsService.update(
    request.user.id,
    request.params.farmId,
    request.body,
  );
  return warnings.length > 0 ? { data: farm, meta: { warnings } } : { data: farm };
}

/** DELETE /farms/{farmId} → 204 (cascade delete). */
export async function deleteFarm(
  request: FastifyRequest<{ Params: FarmIdParams }>,
  reply: FastifyReply,
): Promise<void> {
  await farmsService.remove(request.user.id, request.params.farmId);
  await reply.status(204).send();
}
