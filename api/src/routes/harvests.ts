/**
 * Harvests routes — mounted at `/api/v1/farms/:farmId/harvests` (the farm-scope
 * hook on the parent subtree is already applied, so `request.farm` is the
 * authenticated user's owned farm).
 *
 *   GET /  → list all harvest records of the active farm (most recent first)
 */

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import * as fieldsController from '../controllers/fields.controller';
import { harvestsListResponse } from '../schemas/harvests';

const harvestsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['Harvests'],
        summary: 'Listar historial de cosechas de la partida',
        response: { 200: harvestsListResponse },
      },
    },
    fieldsController.listFarmHarvests,
  );
};

export default harvestsRoutes;
