/**
 * Stables routes (H4.4) — mounted by app.ts under
 * `/api/v1/farms/:farmId/stables`.
 *
 * Wires the `/farms/:farmId/stables` contract from docs/openapi.yaml to the
 * stables controller (list / create / get / update / delete).
 *
 * Authorization: every route is nested under a farm, so the {@link farmScope}
 * `onRequest` hook resolves and authorises the farm (ownership → 404 via
 * FARM_NOT_FOUND; ADR-005) and decorates `request.farm` before the handler runs.
 * The hook is attached here for the whole plugin so a new route in this file
 * cannot forget it. Auth itself is enforced by the global auth hook
 * (src/plugins/auth.ts), which runs first.
 *
 * Every route declares its zod params/body/response schemas so
 * fastify-type-provider-zod validates input (→ 422 VALIDATION_ERROR) and
 * serialises responses.
 */

import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { farmScope } from '../plugins/farm-scope';
import * as stablesController from '../controllers/stables.controller';
import {
  stableCreateBody,
  stableUpdateBody,
  stableParams,
  stableCollectionParams,
  stableResponse,
  stablesListResponse,
} from '../schemas/stables';

const stablesRoutes: FastifyPluginAsyncZod = async (app) => {
  // Resolve + authorise the farm for every route in this subtree.
  app.addHook('onRequest', farmScope);

  app.get(
    '/',
    {
      schema: {
        tags: ['Stables'],
        summary: 'Listar establos de la partida',
        params: stableCollectionParams,
        response: { 200: stablesListResponse },
      },
    },
    stablesController.listStables,
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['Stables'],
        summary: 'Crear establo',
        params: stableCollectionParams,
        body: stableCreateBody,
        response: { 201: stableResponse },
      },
    },
    stablesController.createStable,
  );

  app.get(
    '/:stableId',
    {
      schema: {
        tags: ['Stables'],
        summary: 'Detalle de establo',
        params: stableParams,
        response: { 200: stableResponse },
      },
    },
    stablesController.getStable,
  );

  app.patch(
    '/:stableId',
    {
      schema: {
        tags: ['Stables'],
        summary: 'Actualizar establo',
        params: stableParams,
        body: stableUpdateBody,
        response: { 200: stableResponse },
      },
    },
    stablesController.updateStable,
  );

  app.delete(
    '/:stableId',
    {
      schema: {
        tags: ['Stables'],
        summary: 'Borrar establo',
        params: stableParams,
        response: { 204: z.null() },
      },
    },
    stablesController.deleteStable,
  );
};

export default stablesRoutes;
