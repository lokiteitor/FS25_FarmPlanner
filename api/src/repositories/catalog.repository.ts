/**
 * Data access for the read-only game catalog (H4.1).
 *
 * Covers the versioned catalog tables: game_versions, crops, silage_crops,
 * animal_types and game_constants. Everything here is read-only for users — the
 * catalogs are written exclusively by seeds/migrations (ADR-009,
 * docs/autorizacion-api.md). Per the layering rules, all catalog SQL lives here
 * and nowhere else.
 *
 * Game-version resolution is the single source of truth for "which version does
 * a catalog request serve": an explicit `?gameVersionId` if it exists, otherwise
 * the single active version. `getActiveGameVersionId` is exported here so callers
 * have one canonical implementation (the farms repository keeps its own copy for
 * the register flow, but new catalog/code paths should import this one).
 */

import { eq, asc } from 'drizzle-orm';

import { db, type DbExecutor } from '../db/client';
import {
  gameVersions,
  crops,
  silageCrops,
  animalTypes,
  gameConstants,
} from '../db/schema';
import { NotFoundError } from '../lib/errors';

export type GameVersionRow = typeof gameVersions.$inferSelect;
export type CropRow = typeof crops.$inferSelect;
export type SilageCropRow = typeof silageCrops.$inferSelect;
export type AnimalTypeRow = typeof animalTypes.$inferSelect;
export type GameConstantRow = typeof gameConstants.$inferSelect;

/** A silage_crops row joined with its base crop's slug (derived, not a column). */
export type SilageCropWithSlug = SilageCropRow & { cropSlug: string };

/**
 * Return the id of the single active game version (game_versions.is_active),
 * the default version served by catalog endpoints and assigned to new farms.
 *
 * Throws a clear operational error if none is active — that means the catalog
 * was never seeded, which is a misconfiguration rather than a client error.
 */
export async function getActiveGameVersionId(
  tx: DbExecutor = db,
): Promise<string> {
  const rows = await tx
    .select({ id: gameVersions.id })
    .from(gameVersions)
    .where(eq(gameVersions.isActive, true))
    .limit(1);

  const active = rows[0];
  if (!active) {
    throw new Error(
      'No active game version found (game_versions.is_active). Seed the catalog before serving the catalog API.',
    );
  }
  return active.id;
}

/** List every game version, oldest first (uuidv7 PKs are time-ordered). */
export async function listGameVersions(
  tx: DbExecutor = db,
): Promise<GameVersionRow[]> {
  return tx.select().from(gameVersions).orderBy(asc(gameVersions.id));
}

/** Fetch a single game version by id, or `undefined` if it does not exist. */
export async function getGameVersionById(
  id: string,
  tx: DbExecutor = db,
): Promise<GameVersionRow | undefined> {
  const rows = await tx
    .select()
    .from(gameVersions)
    .where(eq(gameVersions.id, id))
    .limit(1);
  return rows[0];
}

/**
 * Resolve the game version a catalog request targets:
 *  - an explicit id: returned if it exists, else `404 GAME_VERSION_NOT_FOUND`
 *    (a client asked for a version that isn't there);
 *  - no id: the active version.
 *
 * Returning the id (not the row) keeps callers cheap; the list endpoints only
 * need the id to filter and to build the ETag.
 */
export async function resolveGameVersionId(
  gameVersionId: string | undefined,
  tx: DbExecutor = db,
): Promise<string> {
  if (gameVersionId === undefined) {
    return getActiveGameVersionId(tx);
  }
  const version = await getGameVersionById(gameVersionId, tx);
  if (!version) {
    throw new NotFoundError('GAME_VERSION_NOT_FOUND', 'Game version not found');
  }
  return gameVersionId;
}

/** List the crops of a game version, ordered by slug for a stable response. */
export async function listCrops(
  gameVersionId: string,
  tx: DbExecutor = db,
): Promise<CropRow[]> {
  return tx
    .select()
    .from(crops)
    .where(eq(crops.gameVersionId, gameVersionId))
    .orderBy(asc(crops.slug));
}

/**
 * List the silage crops of a game version, joined with `crops` to expose the
 * base crop's `slug` (the API contract surfaces `cropSlug`, which is derived by
 * this join — it is not a column on silage_crops; see docs/base-de-datos.md §6).
 * Ordered by crop slug for a stable response.
 */
export async function listSilageCrops(
  gameVersionId: string,
  tx: DbExecutor = db,
): Promise<SilageCropWithSlug[]> {
  const rows = await tx
    .select({
      silage: silageCrops,
      cropSlug: crops.slug,
    })
    .from(silageCrops)
    .innerJoin(crops, eq(silageCrops.cropId, crops.id))
    .where(eq(silageCrops.gameVersionId, gameVersionId))
    .orderBy(asc(crops.slug));

  return rows.map((r) => ({ ...r.silage, cropSlug: r.cropSlug }));
}

/** List the animal types of a game version, ordered by species. */
export async function listAnimalTypes(
  gameVersionId: string,
  tx: DbExecutor = db,
): Promise<AnimalTypeRow[]> {
  return tx
    .select()
    .from(animalTypes)
    .where(eq(animalTypes.gameVersionId, gameVersionId))
    .orderBy(asc(animalTypes.species));
}

/** List the raw game_constants KV rows of a game version, ordered by key. */
export async function listConstants(
  gameVersionId: string,
  tx: DbExecutor = db,
): Promise<GameConstantRow[]> {
  return tx
    .select()
    .from(gameConstants)
    .where(eq(gameConstants.gameVersionId, gameVersionId))
    .orderBy(asc(gameConstants.key));
}
