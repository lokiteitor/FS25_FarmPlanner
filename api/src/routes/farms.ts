/**
 * Farms routes (H4 Wire) — mounted by app.ts at `/api/v1/farms`.
 *
 * This plugin assembles the whole farm subtree from the per-resource route
 * plugins built in H4.2–H4.5:
 *
 *   1. Farm CRUD at the root of the subtree (paths RELATIVE to the `/farms`
 *      prefix added at registration):
 *        - GET    /            list farms (paginated; meta.pagination)
 *        - POST   /            create a farm                → 201
 *        - GET    /:farmId     farm detail
 *        - PATCH  /:farmId     partial update (+ meta.warnings on version remap)
 *        - DELETE /:farmId     delete (cascade)             → 204
 *      The `:farmId` handlers resolve ownership inside the farms SERVICE (they
 *      receive `request.user.id`), so a missing or non-owned farm is a
 *      `404 FARM_NOT_FOUND` (ADR-005, never 403). They do NOT need the
 *      farm-scope hook because there is no nested resource to scope.
 *
 *   2. The nested resources, mounted inside an encapsulated `/:farmId` scope
 *      that installs the {@link farmScope} `onRequest` hook FIRST. The hook
 *      resolves + authorises `:farmId` and decorates `request.farm` before any
 *      nested handler runs, so every nested handler can filter by
 *      `request.farm.id` and a non-owned farm 404s before reaching them:
 *        - /:farmId/fields             (fields routes)
 *        - /:farmId/stables            (stables routes)
 *        - /:farmId/machinery          (machinery routes)
 *        - /:farmId/animal-configs     (animal-configs routes)
 *        - /:farmId/calculator-states  (calculator-states routes)
 *
 * Some of the nested plugins (stables, machinery, animal-configs,
 * calculator-states) ALSO attach farm-scope internally. That is intentional and
 * harmless: the hook is idempotent (it re-resolves the same owned farm and
 * re-decorates `request.farm`). Attaching it here as well guarantees the hook
 * also covers `fields`, which relies on the wire layer to apply it.
 *
 * All farm routes REQUIRE authentication (no `{ public: true }` flag), so the
 * global auth onRequest hook (src/plugins/auth.ts) runs first and populates
 * `request.user`, which both the service-level ownership checks and the
 * farm-scope hook depend on.
 */

import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { farmScope } from '../plugins/farm-scope';
import * as farmsController from '../controllers/farms.controller';
import fieldsRoutes from './fields';
import harvestsRoutes from './harvests';
import stablesRoutes from './stables';
import machineryRoutes from './machinery';
import animalConfigsRoutes from './animalConfigs';
import calculatorStatesRoutes from './calculatorStates';
import productionBuildingsRoutes from './productionBuildings';
import {
  farmCreateBody,
  farmUpdateBody,
  farmIdParams,
  farmListQuery,
  farmListResponse,
  farmResponse,
  farmUpdateResponse,
} from '../schemas/farms';

const farmsRoutes: FastifyPluginAsyncZod = async (app) => {
  // -------------------------------------------------------------------------
  // Farm CRUD (ownership resolved by the service via request.user.id).
  // -------------------------------------------------------------------------

  app.get(
    '/',
    {
      schema: {
        tags: ['Farms'],
        summary: 'Listar partidas del usuario',
        querystring: farmListQuery,
        response: { 200: farmListResponse },
      },
    },
    farmsController.listFarms,
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['Farms'],
        summary: 'Crear partida',
        body: farmCreateBody,
        response: { 201: farmResponse },
      },
    },
    farmsController.createFarm,
  );

  app.get(
    '/:farmId',
    {
      schema: {
        tags: ['Farms'],
        summary: 'Detalle de partida',
        params: farmIdParams,
        response: { 200: farmResponse },
      },
    },
    farmsController.getFarm,
  );

  app.patch(
    '/:farmId',
    {
      schema: {
        tags: ['Farms'],
        summary: 'Actualizar partida',
        params: farmIdParams,
        body: farmUpdateBody,
        response: { 200: farmUpdateResponse },
      },
    },
    farmsController.updateFarm,
  );

  app.delete(
    '/:farmId',
    {
      schema: {
        tags: ['Farms'],
        summary: 'Borrar partida',
        params: farmIdParams,
        response: { 204: z.null() },
      },
    },
    farmsController.deleteFarm,
  );

  // -------------------------------------------------------------------------
  // Nested resources under /:farmId, all guarded by the farm-scope hook so
  // request.farm is the authenticated user's owned farm (or the request is
  // already a 404 FARM_NOT_FOUND) before any nested handler runs.
  // -------------------------------------------------------------------------

  await app.register(
    async (scoped) => {
      // Resolve + authorise :farmId once for the whole nested subtree; this
      // also covers `fields`, which does not attach farm-scope itself.
      scoped.addHook('onRequest', farmScope);

      await scoped.register(fieldsRoutes, { prefix: '/:farmId/fields' });
      await scoped.register(harvestsRoutes, { prefix: '/:farmId/harvests' });
      await scoped.register(stablesRoutes, { prefix: '/:farmId/stables' });
      await scoped.register(machineryRoutes, { prefix: '/:farmId/machinery' });
      await scoped.register(animalConfigsRoutes, {
        prefix: '/:farmId/animal-configs',
      });
      await scoped.register(calculatorStatesRoutes, {
        prefix: '/:farmId/calculator-states',
      });
      await scoped.register(productionBuildingsRoutes, {
        prefix: '/:farmId/production-buildings',
      });
    },
  );
};

export default farmsRoutes;
