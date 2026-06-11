/**
 * Catalog controller (H4.1): HTTP adapters for the read-only `/catalog/*` routes.
 *
 * Controllers stay thin: resolve the target game version (explicit `?gameVersionId`
 * or the active one) via the repository, fetch + map rows to DTOs, and apply the
 * catalog caching contract (docs/arquitectura-api.md §13 "Cache de catálogos"):
 *
 *   - Catalogs are immutable per game version, so every response carries a weak
 *     ETag derived from the resolved version (`W/"gv-<id>"`) and
 *     `Cache-Control: public, max-age=86400`.
 *   - Conditional requests: when the client's `If-None-Match` already matches the
 *     ETag, we answer `304 Not Modified` with no body (the client's cache is
 *     still valid). The validator changes only when the version changes.
 *
 * No business logic lives here — catalogs have no domain rules beyond version
 * resolution, which is the repository's job. Domain errors (e.g. a non-existent
 * `gameVersionId` → 404 GAME_VERSION_NOT_FOUND) bubble up to the error handler.
 *
 * NOTE: 304 short-circuits before the route's zod response serializer runs, so
 * these handlers drive the reply directly (`reply.send(...)`) rather than
 * returning a value; the declared response schemas still document + serialize
 * the 200 bodies we build here.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import * as catalogRepository from '../repositories/catalog.repository';
import {
  mapGameVersion,
  mapCrop,
  mapSilageCrop,
  mapAnimalType,
  mapGameConstants,
} from '../schemas/catalogResponse';
import type { GameVersionQuery } from '../schemas/catalogResponse';

/** Seconds in a day — the catalog cache lifetime. */
const CACHE_MAX_AGE = 86_400;
const CACHE_CONTROL = `public, max-age=${CACHE_MAX_AGE}`;

/** Build the weak validator for a game version. */
function etagFor(gameVersionId: string): string {
  return `W/"gv-${gameVersionId}"`;
}

/**
 * Apply the catalog cache headers and handle conditional requests.
 *
 * Returns `true` when the request was answered with `304 Not Modified` (the
 * caller must then stop); `false` when the caller should send the 200 body.
 */
function applyCatalogCache(
  request: FastifyRequest,
  reply: FastifyReply,
  gameVersionId: string,
): boolean {
  const etag = etagFor(gameVersionId);
  reply.header('ETag', etag);
  reply.header('Cache-Control', CACHE_CONTROL);

  if (request.headers['if-none-match'] === etag) {
    // Client cache is still valid: 304, no body. Headers above stay on the
    // response so the validator/cache policy are reaffirmed.
    void reply.status(304).send();
    return true;
  }
  return false;
}

/**
 * GET /catalog/game-versions → 200 { data: GameVersion[] }.
 *
 * Not version-scoped (it lists every version), so its ETag is derived from the
 * active version — the validator the rest of the catalog uses by default.
 */
export async function listGameVersions(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const activeId = await catalogRepository.getActiveGameVersionId();
  if (applyCatalogCache(request, reply, activeId)) return;

  const rows = await catalogRepository.listGameVersions();
  void reply.status(200).send({ data: rows.map(mapGameVersion) });
}

/** GET /catalog/crops → 200 { data: Crop[], meta: { gameVersionId } }. */
export async function listCrops(
  request: FastifyRequest<{ Querystring: GameVersionQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const gameVersionId = await catalogRepository.resolveGameVersionId(
    request.query.gameVersionId,
  );
  if (applyCatalogCache(request, reply, gameVersionId)) return;

  const rows = await catalogRepository.listCrops(gameVersionId);
  void reply
    .status(200)
    .send({ data: rows.map(mapCrop), meta: { gameVersionId } });
}

/** GET /catalog/silage-crops → 200 { data: SilageCrop[] }. */
export async function listSilageCrops(
  request: FastifyRequest<{ Querystring: GameVersionQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const gameVersionId = await catalogRepository.resolveGameVersionId(
    request.query.gameVersionId,
  );
  if (applyCatalogCache(request, reply, gameVersionId)) return;

  const rows = await catalogRepository.listSilageCrops(gameVersionId);
  void reply.status(200).send({ data: rows.map(mapSilageCrop) });
}

/** GET /catalog/animal-types → 200 { data: AnimalType[] }. */
export async function listAnimalTypes(
  request: FastifyRequest<{ Querystring: GameVersionQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const gameVersionId = await catalogRepository.resolveGameVersionId(
    request.query.gameVersionId,
  );
  if (applyCatalogCache(request, reply, gameVersionId)) return;

  const rows = await catalogRepository.listAnimalTypes(gameVersionId);
  void reply.status(200).send({ data: rows.map(mapAnimalType) });
}

/** GET /catalog/constants → 200 { data: GameConstants }. */
export async function getConstants(
  request: FastifyRequest<{ Querystring: GameVersionQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const gameVersionId = await catalogRepository.resolveGameVersionId(
    request.query.gameVersionId,
  );
  if (applyCatalogCache(request, reply, gameVersionId)) return;

  const rows = await catalogRepository.listConstants(gameVersionId);
  void reply.status(200).send({ data: mapGameConstants(rows) });
}
