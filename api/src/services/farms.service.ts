/**
 * Farms service (H4.2): CRUD orchestration for a user's partidas/savegames.
 *
 * Responsibilities and boundaries:
 *  - Orchestrates the farms + catalog repositories; ALL DB access goes through
 *    repositories (layered architecture), never raw queries here.
 *  - Throws domain {@link AppError}s; the error-handler plugin turns them into
 *    the standard envelope. Ownership is enforced by scoping every read/write to
 *    `userId`, so a farm owned by someone else is simply `404 FARM_NOT_FOUND`
 *    (ADR-005, never 403).
 *  - Business rules implemented here (docs/base-de-datos.md §9):
 *      · `gameVersionId` defaults to the active version on create and must point
 *        at an existing version (validated against the catalog).
 *      · changing `gameVersionId` on update remaps every assigned field crop by
 *        slug inside one transaction, collecting non-fatal warnings for
 *        `meta.warnings`.
 *      · the one-name-per-user rule yields `409 DUPLICATE_FARM_NAME` (pre-checked
 *        for a clean UX; the `farms_user_name_unique` constraint is the race-safe
 *        backstop mapped by the error handler).
 *
 * The public `Farm` DTO (row + derived fieldCount/stableCount, timestamps as ISO
 * strings) is produced by {@link toFarmDto}.
 */

import { db } from '../db/client';
import { ConflictError, NotFoundError } from '../lib/errors';
import * as catalogRepo from '../repositories/catalog.repository';
import * as farmsRepo from '../repositories/farms.repository';
import type { FarmCounts, FarmRow } from '../repositories/farms.repository';
import type {
  FarmCreateInput,
  FarmDto,
  FarmUpdateInput,
} from '../schemas/farms';

/** A farm row plus its derived counters, the shape every public method returns. */
function toFarmDto(row: FarmRow, counts: FarmCounts): FarmDto {
  return {
    id: row.id,
    userId: row.userId,
    gameVersionId: row.gameVersionId,
    name: row.name,
    mapName: row.mapName ?? null,
    difficulty: row.difficulty,
    defaultYieldBonus: row.defaultYieldBonus,
    sellPriceType: row.sellPriceType,
    notes: row.notes ?? null,
    fieldCount: counts.fieldCount,
    stableCount: counts.stableCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Validate that a game version exists, throwing `404 GAME_VERSION_NOT_FOUND`
 * otherwise. Reuses the catalog repository's resolver, which returns the active
 * version's id when `gameVersionId` is undefined — but callers here always pass a
 * concrete id, so this is purely an existence check.
 */
async function assertGameVersionExists(
  gameVersionId: string,
  tx?: Parameters<typeof catalogRepo.getGameVersionById>[1],
): Promise<void> {
  const version = await catalogRepo.getGameVersionById(gameVersionId, tx);
  if (!version) {
    throw new NotFoundError('GAME_VERSION_NOT_FOUND', 'Game version not found');
  }
}

/** Result of {@link list}: the page of farms (as DTOs) plus the grand total. */
export interface FarmListResult {
  farms: FarmDto[];
  total: number;
}

/**
 * List a user's farms for one page, each enriched with its fieldCount/
 * stableCount, plus the total count for `meta.pagination.total`. The page/perPage
 * are already validated + defaulted by the route schema.
 */
export async function list(
  userId: string,
  page: number,
  perPage: number,
): Promise<FarmListResult> {
  const offset = (page - 1) * perPage;

  const [rows, total] = await Promise.all([
    farmsRepo.listOwned(userId, { limit: perPage, offset }),
    farmsRepo.countOwned(userId),
  ]);

  const farms = await Promise.all(
    rows.map(async (row) =>
      toFarmDto(row, await farmsRepo.countFieldsAndStables(row.id)),
    ),
  );

  return { farms, total };
}

/**
 * Fetch one farm owned by the user (with counts), or `404 FARM_NOT_FOUND` if it
 * does not exist or belongs to someone else.
 */
export async function get(userId: string, farmId: string): Promise<FarmDto> {
  const row = await farmsRepo.findOwned(farmId, userId);
  if (!row) {
    throw new NotFoundError('FARM_NOT_FOUND', 'Farm not found');
  }
  const counts = await farmsRepo.countFieldsAndStables(row.id);
  return toFarmDto(row, counts);
}

/**
 * Create a farm for a user. `gameVersionId` defaults to the active version when
 * omitted and is validated for existence either way. The one-name-per-user rule
 * is pre-checked for a clean `409 DUPLICATE_FARM_NAME`; the unique constraint
 * remains the race-safe backstop (mapped by the error handler).
 *
 * A new farm has no fields or stables yet, so the counters are zero.
 */
export async function create(
  userId: string,
  input: FarmCreateInput,
): Promise<FarmDto> {
  const gameVersionId =
    input.gameVersionId ?? (await catalogRepo.getActiveGameVersionId());

  if (input.gameVersionId !== undefined) {
    await assertGameVersionExists(gameVersionId);
  }

  const existing = await farmsRepo.findByName(userId, input.name);
  if (existing) {
    throw new ConflictError(
      'DUPLICATE_FARM_NAME',
      'Ya tienes una partida con ese nombre',
    );
  }

  const row = await farmsRepo.create(userId, gameVersionId, {
    name: input.name,
    mapName: input.mapName ?? null,
    difficulty: input.difficulty,
    defaultYieldBonus: input.defaultYieldBonus,
    sellPriceType: input.sellPriceType,
    notes: input.notes ?? null,
  });

  return toFarmDto(row, { fieldCount: 0, stableCount: 0 });
}

/** Result of {@link update}: the updated farm plus any non-fatal remap warnings. */
export interface FarmUpdateResult {
  farm: FarmDto;
  warnings: string[];
}

/**
 * Update a farm owned by the user. Establishes ownership first (`404
 * FARM_NOT_FOUND` otherwise). A rename collides with the one-name-per-user rule
 * → `409 DUPLICATE_FARM_NAME` (pre-checked; unique constraint backstops the
 * race).
 *
 * When `gameVersionId` changes, the new version is validated and the whole
 * change runs in a single transaction: the field crops are remapped by slug to
 * the new version (slugs missing there clear the crop and produce a warning),
 * then the farm row is updated — so the farm and its fields never disagree on the
 * version. Returns the warnings so the controller can surface them in
 * `meta.warnings`.
 */
export async function update(
  userId: string,
  farmId: string,
  patch: FarmUpdateInput,
): Promise<FarmUpdateResult> {
  const current = await farmsRepo.findOwned(farmId, userId);
  if (!current) {
    throw new NotFoundError('FARM_NOT_FOUND', 'Farm not found');
  }

  // Pre-check the rename against the one-name-per-user rule (skip when the name
  // is unchanged or absent).
  if (patch.name !== undefined && patch.name !== current.name) {
    const clash = await farmsRepo.findByName(userId, patch.name);
    if (clash && clash.id !== farmId) {
      throw new ConflictError(
        'DUPLICATE_FARM_NAME',
        'Ya tienes una partida con ese nombre',
      );
    }
  }

  const versionChanges =
    patch.gameVersionId !== undefined &&
    patch.gameVersionId !== current.gameVersionId;

  let warnings: string[] = [];
  let updatedRow: FarmRow | undefined;

  if (versionChanges) {
    const newVersionId = patch.gameVersionId as string;

    updatedRow = await db.transaction(async (tx) => {
      await assertGameVersionExists(newVersionId, tx);

      warnings = await farmsRepo.remapFieldCropsBySlug(
        tx,
        farmId,
        current.gameVersionId,
        newVersionId,
      );

      const row = await farmsRepo.update(farmId, toUpdatePatch(patch), tx);
      return row;
    });
  } else {
    // No version change: a plain partial update. Strip gameVersionId in case the
    // client sent the same value (it would be a no-op write anyway).
    updatedRow = await farmsRepo.update(farmId, toUpdatePatch(patch, true));
  }

  // The row was just established as owned; an undefined result would mean a
  // concurrent delete. Treat it as not found.
  if (!updatedRow) {
    throw new NotFoundError('FARM_NOT_FOUND', 'Farm not found');
  }

  const counts = await farmsRepo.countFieldsAndStables(updatedRow.id);
  return { farm: toFarmDto(updatedRow, counts), warnings };
}

/**
 * Translate a validated FarmUpdate body into the repository patch. Only keys the
 * client actually sent are forwarded, so absent keys leave their columns
 * untouched. When `dropVersion` is set the `gameVersionId` is omitted (used on
 * the no-version-change path, where it is either absent or an unchanged no-op).
 */
function toUpdatePatch(
  patch: FarmUpdateInput,
  dropVersion = false,
): farmsRepo.UpdateFarmPatch {
  const out: farmsRepo.UpdateFarmPatch = {};
  if (patch.name !== undefined) out.name = patch.name;
  if (!dropVersion && patch.gameVersionId !== undefined) {
    out.gameVersionId = patch.gameVersionId;
  }
  if (patch.mapName !== undefined) out.mapName = patch.mapName;
  if (patch.difficulty !== undefined) out.difficulty = patch.difficulty;
  if (patch.defaultYieldBonus !== undefined) {
    out.defaultYieldBonus = patch.defaultYieldBonus;
  }
  if (patch.sellPriceType !== undefined) out.sellPriceType = patch.sellPriceType;
  if (patch.notes !== undefined) out.notes = patch.notes;
  return out;
}

/**
 * Delete a farm owned by the user (`404 FARM_NOT_FOUND` otherwise). The DB
 * cascades remove fields, stables, machinery, animal_calculator_configs and
 * calculator_states (docs/base-de-datos.md §9).
 */
export async function remove(userId: string, farmId: string): Promise<void> {
  const current = await farmsRepo.findOwned(farmId, userId);
  if (!current) {
    throw new NotFoundError('FARM_NOT_FOUND', 'Farm not found');
  }
  await farmsRepo.remove(farmId);
}
