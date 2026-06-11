/**
 * Farm-scope authorization helper (H4).
 *
 * Centralises ownership resolution for every nested resource living under
 * `/farms/:farmId/*` (fields, stables, machinery, animal-configs,
 * calculator-states). Attached as an `onRequest` hook on those route subtrees,
 * it:
 *   1. reads `request.params.farmId`,
 *   2. loads the farm scoped to the authenticated user via
 *      `farmsRepo.findOwned(farmId, request.user.id)` (ownership filter lives in
 *      the query, never as a post-filter),
 *   3. throws `NotFoundError('FARM_NOT_FOUND')` (404, not 403 — ADR-005) if the
 *      farm does not exist or belongs to another user,
 *   4. otherwise decorates `request.farm` with the row so child handlers can
 *      filter by `request.farm.id` without re-checking ownership.
 *
 * Because auth runs as a global `onRequest` hook (see `src/plugins/auth.ts`),
 * `request.user` is already populated by the time this runs.
 *
 * Two ways to use it (the route layer in H4.1/H4.2 picks one):
 *   - import `farmScope` and attach it as a route/scope `onRequest` hook, or
 *   - register the default plugin export inside an encapsulated route scope so
 *     it installs the hook for every route registered after it.
 *
 * See `docs/autorizacion-api.md` (§ Middleware y Validaciones).
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { NotFoundError } from '../lib/errors';
import * as farmsRepo from '../repositories/farms.repository';

/** Shape of the path params a farm-scoped route always carries. */
interface FarmScopeParams {
  farmId: string;
}

/**
 * `onRequest` hook that resolves and authorizes the farm in `:farmId`, then
 * decorates `request.farm`. Throws `NotFoundError('FARM_NOT_FOUND')` for missing
 * or non-owned farms so cross-user access is indistinguishable from a 404.
 *
 * Export it standalone so a route can attach it directly:
 *
 * @example
 *   fastify.get('/farms/:farmId/fields', { onRequest: farmScope }, handler);
 */
export async function farmScope(request: FastifyRequest): Promise<void> {
  const { farmId } = request.params as FarmScopeParams;

  const farm = await farmsRepo.findOwned(farmId, request.user.id);
  if (!farm) {
    throw new NotFoundError('FARM_NOT_FOUND');
  }

  request.farm = farm;
}

/**
 * Encapsulated plugin variant: installs {@link farmScope} as an `onRequest` hook
 * for the enclosing scope. Register it at the top of a `/farms/:farmId` route
 * group so every nested route inherits the ownership check.
 *
 * @example
 *   fastify.register(async (scoped) => {
 *     await scoped.register(farmScopePlugin);
 *     scoped.get('/farms/:farmId/fields', handler);
 *   });
 */
async function farmScopePlugin(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', farmScope);
}

export default fp(farmScopePlugin, {
  name: 'farm-scope',
  fastify: '5.x',
  dependencies: ['auth'],
});
