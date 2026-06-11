/**
 * CalculatorStates routes (H4.5) — mounted by app.ts at
 * `/api/v1/farms/:farmId/calculator-states`.
 *
 * Wires the CalculatorStates contract from docs/openapi.yaml to the controller:
 *   - GET /:toolKey   fetch the tool's saved state (404 CALCULATOR_STATE_NOT_FOUND)
 *   - PUT /:toolKey   create-or-replace (upsert) the state → 200
 *
 * There is no list, create or delete endpoint in v1 (state is per (farm, tool)
 * and upserted via PUT).
 *
 * Authorization: the farm-scope plugin is registered first so every route in
 * this subtree resolves + ownership-checks `:farmId` (→ 404 FARM_NOT_FOUND for a
 * missing or non-owned farm) and decorates `request.farm`. Auth itself is the
 * global onRequest hook (no `public` flag here).
 *
 * Every route declares its zod params/body/response schemas so
 * fastify-type-provider-zod validates the `{toolKey}` enum + the state body
 * (→ 422 VALIDATION_ERROR) and serialises the responses.
 */

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import farmScopePlugin from '../plugins/farm-scope';
import * as calculatorStatesController from '../controllers/calculatorStates.controller';
import {
  calculatorStateInput,
  calculatorStateResponse,
  toolKeyParams,
} from '../schemas/calculatorStates';

const calculatorStatesRoutes: FastifyPluginAsyncZod = async (app) => {
  // Ownership scoping for the whole subtree: resolves request.farm or 404s.
  await app.register(farmScopePlugin);

  app.get(
    '/:toolKey',
    {
      schema: {
        tags: ['CalculatorStates'],
        summary: 'Obtener estado de una herramienta',
        params: toolKeyParams,
        response: { 200: calculatorStateResponse },
      },
    },
    calculatorStatesController.get,
  );

  app.put(
    '/:toolKey',
    {
      schema: {
        tags: ['CalculatorStates'],
        summary: 'Crear o reemplazar (upsert) el estado de una herramienta',
        params: toolKeyParams,
        body: calculatorStateInput,
        response: { 200: calculatorStateResponse },
      },
    },
    calculatorStatesController.upsert,
  );
};

export default calculatorStatesRoutes;
