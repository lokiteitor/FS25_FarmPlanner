/**
 * User Settings controller (H4.6): thin HTTP adapters for the `/me/settings`
 * routes.
 *
 * Controllers only translate between the request/response cycle and the service
 * layer: read the authenticated user id off `request.user` (populated by the
 * global auth hook), pass the validated body, and wrap the result in the success
 * envelope `{ data }`. No business logic, no DB access, no error handling —
 * domain errors (e.g. 422 FARM_NOT_OWNED) bubble up to the error-handler plugin.
 */

import type { FastifyRequest } from 'fastify';

import * as userSettingsService from '../services/userSettings.service';
import type { UserSettingsUpdateInput } from '../schemas/userSettings';

/** GET /me/settings → 200 { data: UserSettings }. */
export async function getSettings(
  request: FastifyRequest,
): Promise<{ data: userSettingsService.PublicUserSettings }> {
  const settings = await userSettingsService.getSettings(request.user.id);
  return { data: settings };
}

/** PATCH /me/settings → 200 { data: UserSettings }. */
export async function updateSettings(
  request: FastifyRequest<{ Body: UserSettingsUpdateInput }>,
): Promise<{ data: userSettingsService.PublicUserSettings }> {
  const settings = await userSettingsService.updateSettings(
    request.user.id,
    request.body,
  );
  return { data: settings };
}
