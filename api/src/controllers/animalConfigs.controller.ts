/**
 * AnimalConfigs controller (H4.5): thin HTTP adapters for the
 * `/farms/:farmId/animal-configs` routes.
 *
 * Controllers only translate between the request/response cycle and the service:
 * read `request.farm` (set by the farm-scope plugin), the validated path params,
 * and the body, then wrap the result in the success envelope `{ data }`. No
 * business logic, no DB access — domain errors bubble to the error-handler.
 *
 * The PUT body is the per-species `inputs` union. The route zod-validates it, but
 * the controller forwards the raw `request.body` so the service can additionally
 * enforce body.species === path species (a cross-field rule) and emit a precise
 * 200 (replaced) vs 201 (created).
 *
 * `request.farm` is guaranteed present here because the farm-scope plugin runs as
 * an onRequest hook on this route subtree; the non-null assertion documents that
 * invariant for TypeScript.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import * as animalConfigsService from '../services/animalConfigs.service';
import type { AnimalConfigDto, SpeciesParams } from '../schemas/animalConfigs';

/** GET /farms/{farmId}/animal-configs → 200 { data: AnimalConfig[] }. */
export async function list(
  request: FastifyRequest,
): Promise<{ data: AnimalConfigDto[] }> {
  const configs = await animalConfigsService.list(request.farm!);
  return { data: configs };
}

/** GET /farms/{farmId}/animal-configs/{species} → 200 { data: AnimalConfig }. */
export async function get(
  request: FastifyRequest<{ Params: SpeciesParams }>,
): Promise<{ data: AnimalConfigDto }> {
  const config = await animalConfigsService.get(
    request.farm!,
    request.params.species,
  );
  return { data: config };
}

/**
 * PUT /farms/{farmId}/animal-configs/{species} → 201 { data } (created) or
 * 200 { data } (replaced). The service determines which.
 */
export async function upsert(
  request: FastifyRequest<{ Params: SpeciesParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { config, created } = await animalConfigsService.upsert(
    request.farm!,
    request.params.species,
    request.body,
  );
  await reply.status(created ? 201 : 200).send({ data: config });
}

/** DELETE /farms/{farmId}/animal-configs/{species} → 204. */
export async function remove(
  request: FastifyRequest<{ Params: SpeciesParams }>,
  reply: FastifyReply,
): Promise<void> {
  await animalConfigsService.remove(request.farm!, request.params.species);
  await reply.status(204).send();
}
