/**
 * Production Buildings routes — mounted by farms.ts under
 * `/api/v1/farms/:farmId/production-buildings`.
 *
 * Wires the CRUD contract to the production buildings controller
 * (list / create / get / update / delete).
 *
 * Authorization: the {@link farmScope} `onRequest` hook is attached here for
 * the whole plugin (resolves + authorises the farm, decorates `request.farm`).
 * The global auth hook (src/plugins/auth.ts) runs first.
 */

import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { farmScope } from '../plugins/farm-scope';
import * as buildingsController from '../controllers/productionBuildings.controller';
import {
  productionBuildingCreateBody,
  productionBuildingUpdateBody,
  productionBuildingParams,
  productionBuildingCollectionParams,
  productionBuildingResponse,
  productionBuildingsListResponse,
} from '../schemas/productionBuildings';

const productionBuildingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', farmScope);

  app.get(
    '/',
    {
      schema: {
        tags: ['ProductionBuildings'],
        summary: 'Listar edificios de producción de la partida',
        params: productionBuildingCollectionParams,
        response: { 200: productionBuildingsListResponse },
      },
    },
    buildingsController.listBuildings,
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['ProductionBuildings'],
        summary: 'Crear edificio de producción',
        params: productionBuildingCollectionParams,
        body: productionBuildingCreateBody,
        response: { 201: productionBuildingResponse },
      },
    },
    buildingsController.createBuilding,
  );

  app.get(
    '/:buildingId',
    {
      schema: {
        tags: ['ProductionBuildings'],
        summary: 'Detalle de edificio de producción',
        params: productionBuildingParams,
        response: { 200: productionBuildingResponse },
      },
    },
    buildingsController.getBuilding,
  );

  app.patch(
    '/:buildingId',
    {
      schema: {
        tags: ['ProductionBuildings'],
        summary: 'Actualizar edificio de producción',
        params: productionBuildingParams,
        body: productionBuildingUpdateBody,
        response: { 200: productionBuildingResponse },
      },
    },
    buildingsController.updateBuilding,
  );

  app.delete(
    '/:buildingId',
    {
      schema: {
        tags: ['ProductionBuildings'],
        summary: 'Borrar edificio de producción',
        params: productionBuildingParams,
        response: { 204: z.null() },
      },
    },
    buildingsController.deleteBuilding,
  );
};

export default productionBuildingsRoutes;
