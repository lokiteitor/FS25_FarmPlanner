/**
 * Fields routes (H4.3) — mounted by the Wire phase at
 * `/api/v1/farms/:farmId/fields` with the farm-scope hook applied to the subtree
 * (so `request.farm` is the authenticated user's owned farm, or the request is
 * already a 404 FARM_NOT_FOUND before any handler runs).
 *
 * Wires the `/farms/{farmId}/fields` contract from docs/openapi.yaml to the
 * fields controller (paths are RELATIVE — the `/farms/:farmId` prefix and
 * farm-scope are added at registration time):
 *   - GET    /            list fields ordered by fieldNumber
 *   - POST   /            create a field            → 201
 *   - GET    /:fieldId    field detail
 *   - PATCH  /:fieldId    partial update
 *   - DELETE /:fieldId    delete                    → 204
 *
 * All routes REQUIRE authentication (no `{ public: true }` flag), so the global
 * auth onRequest hook (src/plugins/auth.ts) enforces a valid access token.
 *
 * Every route declares its zod body/params/response schemas so
 * fastify-type-provider-zod validates input (→ 422 VALIDATION_ERROR) and
 * documents + serialises the responses.
 */

import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import * as fieldsController from '../controllers/fields.controller';
import {
  fieldParams,
  fieldCreateBody,
  fieldUpdateBody,
  fieldResponse,
  fieldsListResponse,
} from '../schemas/fields';

const fieldsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['Fields'],
        summary: 'Listar campos de la partida',
        response: { 200: fieldsListResponse },
      },
    },
    fieldsController.listFields,
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['Fields'],
        summary: 'Crear campo',
        body: fieldCreateBody,
        response: { 201: fieldResponse },
      },
    },
    fieldsController.createField,
  );

  app.get(
    '/:fieldId',
    {
      schema: {
        tags: ['Fields'],
        summary: 'Detalle de campo',
        params: fieldParams,
        response: { 200: fieldResponse },
      },
    },
    fieldsController.getField,
  );

  app.patch(
    '/:fieldId',
    {
      schema: {
        tags: ['Fields'],
        summary: 'Actualizar campo',
        params: fieldParams,
        body: fieldUpdateBody,
        response: { 200: fieldResponse },
      },
    },
    fieldsController.updateField,
  );

  app.delete(
    '/:fieldId',
    {
      schema: {
        tags: ['Fields'],
        summary: 'Borrar campo',
        params: fieldParams,
        response: { 204: z.null() },
      },
    },
    fieldsController.deleteField,
  );
};

export default fieldsRoutes;
