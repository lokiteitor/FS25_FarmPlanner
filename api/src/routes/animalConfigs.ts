/**
 * AnimalConfigs routes (H4.5) — mounted by app.ts at
 * `/api/v1/farms/:farmId/animal-configs`.
 *
 * Wires the AnimalConfigs contract from docs/openapi.yaml to the controller:
 *   - GET    /            list the farm's saved configs (0..7)
 *   - GET    /:species    fetch one species' config (404 CONFIG_NOT_FOUND)
 *   - PUT    /:species    create-or-replace (upsert) → 201 created / 200 replaced
 *   - DELETE /:species    delete (back to catalog defaults) → 204
 *
 * Authorization: the farm-scope plugin is registered first so every route in
 * this subtree resolves + ownership-checks `:farmId` (→ 404 FARM_NOT_FOUND for a
 * missing or non-owned farm) and decorates `request.farm`. Auth itself is the
 * global onRequest hook (no `public` flag here).
 *
 * Every route declares its zod params/body/response schemas so
 * fastify-type-provider-zod validates the `{species}` enum + the per-species
 * `inputs` union (→ 422 VALIDATION_ERROR) and serialises the responses. The PUT
 * declares both 200 and 201 response shapes since the controller chooses at
 * runtime.
 */

import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import farmScopePlugin from '../plugins/farm-scope';
import * as animalConfigsController from '../controllers/animalConfigs.controller';
import {
  animalConfigInputsSchema,
  animalConfigResponse,
  animalConfigListResponse,
  farmIdParams,
  speciesParams,
} from '../schemas/animalConfigs';

const animalConfigsRoutes: FastifyPluginAsyncZod = async (app) => {
  // Ownership scoping for the whole subtree: resolves request.farm or 404s.
  await app.register(farmScopePlugin);

  app.get(
    '/',
    {
      schema: {
        tags: ['AnimalConfigs'],
        summary: 'Listar configuraciones de calculadoras de la partida',
        params: farmIdParams,
        response: { 200: animalConfigListResponse },
      },
    },
    animalConfigsController.list,
  );

  app.get(
    '/:species',
    {
      schema: {
        tags: ['AnimalConfigs'],
        summary: 'Obtener configuración de una especie',
        params: speciesParams,
        response: { 200: animalConfigResponse },
      },
    },
    animalConfigsController.get,
  );

  app.put(
    '/:species',
    {
      schema: {
        tags: ['AnimalConfigs'],
        summary: 'Crear o reemplazar (upsert) la configuración de una especie',
        params: speciesParams,
        body: animalConfigInputsSchema,
        response: {
          200: animalConfigResponse,
          201: animalConfigResponse,
        },
      },
    },
    animalConfigsController.upsert,
  );

  app.delete(
    '/:species',
    {
      schema: {
        tags: ['AnimalConfigs'],
        summary: 'Borrar la configuración (volver a defaults)',
        params: speciesParams,
        response: { 204: z.null() },
      },
    },
    animalConfigsController.remove,
  );
};

export default animalConfigsRoutes;
