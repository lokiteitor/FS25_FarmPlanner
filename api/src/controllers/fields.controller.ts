/**
 * Fields controller (H4.3): thin HTTP adapters for `/farms/{farmId}/fields`.
 *
 * Controllers only translate between the request/response cycle and the service
 * layer: read the farm resolved by the farm-scope plugin (`request.farm`), pull
 * validated input off `request.body` / `request.params`, call the service, and
 * wrap the result in the success envelope `{ data }` (mapping rows to DTOs). No
 * business logic, no DB access, no error handling — domain errors bubble up to
 * the error-handler plugin.
 *
 * `request.farm` is guaranteed by the farm-scope `onRequest` hook the route
 * subtree installs; {@link requireFarm} narrows the optional decorator type and
 * fails loudly if a route is ever mounted without that hook.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { FarmRow } from '../repositories/farms.repository';
import * as fieldsService from '../services/fields.service';
import { mapField } from '../schemas/fields';
import type {
  FieldCreateInput,
  FieldParams,
  FieldUpdateInput,
} from '../schemas/fields';
import { mapHarvest } from '../schemas/harvests';
import type { HarvestInput } from '../schemas/harvests';

/**
 * Read the owned farm decorated by the farm-scope hook. Throws if absent, which
 * can only happen from a wiring mistake (route mounted without farm-scope) — a
 * 500, not a client error.
 */
function requireFarm(request: FastifyRequest): FarmRow {
  if (!request.farm) {
    throw new Error('farm-scope hook did not run: request.farm is undefined');
  }
  return request.farm;
}

/** GET /farms/{farmId}/fields → 200 { data: Field[] }. */
export async function listFields(
  request: FastifyRequest,
): Promise<{ data: ReturnType<typeof mapField>[] }> {
  const fields = await fieldsService.list(requireFarm(request));
  return { data: fields.map(mapField) };
}

/** POST /farms/{farmId}/fields → 201 { data: Field }. */
export async function createField(
  request: FastifyRequest<{ Body: FieldCreateInput }>,
  reply: FastifyReply,
): Promise<void> {
  const field = await fieldsService.create(requireFarm(request), request.body);
  await reply.status(201).send({ data: mapField(field) });
}

/** GET /farms/{farmId}/fields/{fieldId} → 200 { data: Field }. */
export async function getField(
  request: FastifyRequest<{ Params: FieldParams }>,
): Promise<{ data: ReturnType<typeof mapField> }> {
  const field = await fieldsService.get(
    requireFarm(request),
    request.params.fieldId,
  );
  return { data: mapField(field) };
}

/** PATCH /farms/{farmId}/fields/{fieldId} → 200 { data: Field }. */
export async function updateField(
  request: FastifyRequest<{ Params: FieldParams; Body: FieldUpdateInput }>,
): Promise<{ data: ReturnType<typeof mapField> }> {
  const field = await fieldsService.update(
    requireFarm(request),
    request.params.fieldId,
    request.body,
  );
  return { data: mapField(field) };
}

/** DELETE /farms/{farmId}/fields/{fieldId} → 204. */
export async function deleteField(
  request: FastifyRequest<{ Params: FieldParams }>,
  reply: FastifyReply,
): Promise<void> {
  await fieldsService.remove(requireFarm(request), request.params.fieldId);
  await reply.status(204).send();
}

// ---------------------------------------------------------------------------
// Lifecycle actions
// ---------------------------------------------------------------------------

/** POST /farms/{farmId}/fields/{fieldId}/sow → 200 { data: Field }. */
export async function sowField(
  request: FastifyRequest<{ Params: FieldParams }>,
): Promise<{ data: ReturnType<typeof mapField> }> {
  const field = await fieldsService.sow(
    requireFarm(request),
    request.params.fieldId,
  );
  return { data: mapField(field) };
}

/** POST /farms/{farmId}/fields/{fieldId}/cancel-sow → 200 { data: Field }. */
export async function cancelSowField(
  request: FastifyRequest<{ Params: FieldParams }>,
): Promise<{ data: ReturnType<typeof mapField> }> {
  const field = await fieldsService.cancelSow(
    requireFarm(request),
    request.params.fieldId,
  );
  return { data: mapField(field) };
}

/** POST /farms/{farmId}/fields/{fieldId}/harvest → 200 { data: Field }. */
export async function harvestField(
  request: FastifyRequest<{ Params: FieldParams; Body: HarvestInput }>,
): Promise<{ data: ReturnType<typeof mapField> }> {
  const { field } = await fieldsService.harvest(
    requireFarm(request),
    request.params.fieldId,
    request.body,
  );
  return { data: mapField(field) };
}

/** GET /farms/{farmId}/harvests → 200 { data: HarvestRecord[] }. */
export async function listFarmHarvests(
  request: FastifyRequest,
): Promise<{ data: ReturnType<typeof mapHarvest>[] }> {
  const records = await fieldsService.listHarvests(requireFarm(request));
  return { data: records.map(mapHarvest) };
}
