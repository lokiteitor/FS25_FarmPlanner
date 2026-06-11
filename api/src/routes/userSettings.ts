/**
 * User Settings routes (H4.6) — mounted by app.ts at `/api/v1/me/settings`.
 *
 * Wires the `/me/settings` contract from docs/openapi.yaml to the controller:
 *   - GET '/'    current UI preferences (lazily created with defaults)
 *   - PATCH '/'  partial update of UI preferences
 *
 * Both routes REQUIRE authentication (user-settings:*:own; ownership is the row
 * itself, keyed by user_id). They carry NO `{ public: true }` flag, so the
 * global auth onRequest hook (src/plugins/auth.ts) enforces a valid access token
 * and populates `request.user`.
 *
 * Every route declares its zod body/response schemas so fastify-type-provider
 * -zod validates the PATCH body (→ 422 VALIDATION_ERROR) and documents +
 * serialises the response. A non-owned `activeFarmId` is a business-rule failure
 * surfaced by the service as 422 FARM_NOT_OWNED.
 */

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import * as userSettingsController from '../controllers/userSettings.controller';
import {
  userSettingsUpdateBody,
  userSettingsResponse,
} from '../schemas/userSettings';

const userSettingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      schema: {
        tags: ['UserSettings'],
        summary: 'Preferencias de UI del usuario',
        response: { 200: userSettingsResponse },
      },
    },
    userSettingsController.getSettings,
  );

  app.patch(
    '/',
    {
      schema: {
        tags: ['UserSettings'],
        summary: 'Actualizar preferencias de UI',
        body: userSettingsUpdateBody,
        response: { 200: userSettingsResponse },
      },
    },
    userSettingsController.updateSettings,
  );
};

export default userSettingsRoutes;
