/**
 * Machinery routes (H4.4) — mounted by app.ts under
 * `/api/v1/farms/:farmId/machinery`.
 *
 * Wires the `/farms/:farmId/machinery` contract from docs/openapi.yaml to the
 * machinery controller (list / create / get / update / delete).
 *
 * Authorization: every route is nested under a farm, so the {@link farmScope}
 * `onRequest` hook resolves and authorises the farm (ownership → 404 via
 * FARM_NOT_FOUND; ADR-005) and decorates `request.farm` before the handler runs.
 * The hook is attached here for the whole plugin so a new route in this file
 * cannot forget it. Auth itself is enforced by the global auth hook
 * (src/plugins/auth.ts), which runs first.
 *
 * Machinery has no name uniqueness (docs/base-de-datos.md §12), so there is no
 * 409 path. Every route declares its zod params/body/response schemas so
 * fastify-type-provider-zod validates input (→ 422 VALIDATION_ERROR) and
 * serialises responses.
 */

import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { farmScope } from '../plugins/farm-scope';
import * as machineryController from '../controllers/machinery.controller';
import {
  machineCreateBody,
  machineUpdateBody,
  machineParams,
  machineCollectionParams,
  machineResponse,
  machineryListResponse,
} from '../schemas/machinery';

const machineryRoutes: FastifyPluginAsyncZod = async (app) => {
  // Resolve + authorise the farm for every route in this subtree.
  app.addHook('onRequest', farmScope);

  app.get(
    '/',
    {
      schema: {
        tags: ['Machinery'],
        summary: 'Listar maquinaria de la partida',
        params: machineCollectionParams,
        response: { 200: machineryListResponse },
      },
    },
    machineryController.listMachinery,
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['Machinery'],
        summary: 'Crear equipo',
        params: machineCollectionParams,
        body: machineCreateBody,
        response: { 201: machineResponse },
      },
    },
    machineryController.createMachine,
  );

  app.get(
    '/:machineId',
    {
      schema: {
        tags: ['Machinery'],
        summary: 'Detalle de equipo',
        params: machineParams,
        response: { 200: machineResponse },
      },
    },
    machineryController.getMachine,
  );

  app.patch(
    '/:machineId',
    {
      schema: {
        tags: ['Machinery'],
        summary: 'Actualizar equipo',
        params: machineParams,
        body: machineUpdateBody,
        response: { 200: machineResponse },
      },
    },
    machineryController.updateMachine,
  );

  app.delete(
    '/:machineId',
    {
      schema: {
        tags: ['Machinery'],
        summary: 'Borrar equipo',
        params: machineParams,
        response: { 204: z.null() },
      },
    },
    machineryController.deleteMachine,
  );
};

export default machineryRoutes;
