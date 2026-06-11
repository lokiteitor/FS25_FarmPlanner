import { and, asc, count, eq, isNotNull } from 'drizzle-orm';
import { db, type DbExecutor } from '../db/client';
import { crops, farms, fields, gameVersions, stables } from '../db/schema';
import type { Difficulty, SellPriceType } from '../db/schema/enums';

/**
 * Data access for the `farms` table.
 *
 * Only the registration helper (`createDefault`) and the active-game-version
 * lookup live here for now; the full farm CRUD arrives in H4. Both accept an
 * optional executor (`tx`, defaulting to `db`) so the default farm can be
 * created inside the register transaction.
 */

export type FarmRow = typeof farms.$inferSelect;

export interface CreateDefaultFarmInput {
  userId: string;
  gameVersionId: string;
  /** Defaults to "Mi partida" (docs/base-de-datos.md §1 business rules). */
  name?: string;
}

/** Default name for the farm created automatically at registration. */
export const DEFAULT_FARM_NAME = 'Mi partida';

/**
 * Create the default farm that every new account gets at registration.
 *
 * difficulty 'normal', default_yield_bonus (column default 0.4250) and
 * sell_price_type 'baseline' are taken from the table defaults
 * (docs/base-de-datos.md §9); we don't pass them so a future change to the
 * column defaults stays in one place. Returns the created row.
 */
export async function createDefault(
  input: CreateDefaultFarmInput,
  tx: DbExecutor = db,
): Promise<FarmRow> {
  const [row] = await tx
    .insert(farms)
    .values({
      userId: input.userId,
      gameVersionId: input.gameVersionId,
      name: input.name ?? DEFAULT_FARM_NAME,
      difficulty: 'normal',
      sellPriceType: 'baseline',
    })
    .returning();
  return row;
}

/**
 * Return the id of the single active game version (game_versions.is_active),
 * used as the default version for new farms and catalog reads.
 *
 * Throws a clear error if none is active — that means the catalog was never
 * seeded, which is an operational misconfiguration rather than a user error.
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
      'No active game version found (game_versions.is_active). Seed the catalog before registering farms.',
    );
  }
  return active.id;
}

/**
 * Find a farm by id scoped to its owner. The ownership filter is part of the
 * query (`user_id = userId`), so a farm belonging to another user is simply not
 * found — the service/plugin maps that to `404 FARM_NOT_FOUND` (ADR-005), never
 * a 403. Backs the farm-scope plugin and `GET /farms/{farmId}`.
 */
export async function findOwned(
  id: string,
  userId: string,
  tx: DbExecutor = db,
): Promise<FarmRow | undefined> {
  const rows = await tx
    .select()
    .from(farms)
    .where(and(eq(farms.id, id), eq(farms.userId, userId)))
    .limit(1);
  return rows[0];
}

/**
 * Find a user's farm by exact name (scoped to the owner), or `undefined`. Backs
 * the clean-UX duplicate pre-check in the service before create/rename; the
 * `farms_user_name_unique` constraint is the race-safe backstop.
 */
export async function findByName(
  userId: string,
  name: string,
  tx: DbExecutor = db,
): Promise<FarmRow | undefined> {
  const rows = await tx
    .select()
    .from(farms)
    .where(and(eq(farms.userId, userId), eq(farms.name, name)))
    .limit(1);
  return rows[0];
}

export interface ListOwnedOptions {
  limit: number;
  offset: number;
}

/**
 * List a user's farms ordered by creation time (uuidv7 PK is time-ordered, but
 * we order explicitly by `created_at` for clarity). Pagination is applied here;
 * pair with {@link countOwned} for the total. Only `GET /farms` paginates.
 */
export async function listOwned(
  userId: string,
  { limit, offset }: ListOwnedOptions,
  tx: DbExecutor = db,
): Promise<FarmRow[]> {
  return tx
    .select()
    .from(farms)
    .where(eq(farms.userId, userId))
    .orderBy(asc(farms.createdAt))
    .limit(limit)
    .offset(offset);
}

/** Total number of farms owned by a user (for `meta.pagination.total`). */
export async function countOwned(
  userId: string,
  tx: DbExecutor = db,
): Promise<number> {
  const rows = await tx
    .select({ value: count() })
    .from(farms)
    .where(eq(farms.userId, userId));
  return rows[0]?.value ?? 0;
}

/**
 * Fields to insert for a new farm. `userId` and `gameVersionId` are passed
 * separately by the service (the latter defaults to the active version when the
 * client omits it). Optional columns fall back to their DB defaults when
 * omitted.
 */
export interface CreateFarmInput {
  name: string;
  mapName?: string | null;
  difficulty?: Difficulty;
  defaultYieldBonus?: number;
  sellPriceType?: SellPriceType;
  notes?: string | null;
}

/**
 * Create a farm for a user. The `farms_user_name_unique` constraint enforces the
 * one-name-per-user rule; the service may pre-check and the error-handler maps
 * the 23505 to `409 DUPLICATE_FARM_NAME` as a race-safe fallback.
 */
export async function create(
  userId: string,
  gameVersionId: string,
  input: CreateFarmInput,
  tx: DbExecutor = db,
): Promise<FarmRow> {
  const [row] = await tx
    .insert(farms)
    .values({
      userId,
      gameVersionId,
      name: input.name,
      mapName: input.mapName ?? null,
      ...(input.difficulty !== undefined
        ? { difficulty: input.difficulty }
        : {}),
      ...(input.defaultYieldBonus !== undefined
        ? { defaultYieldBonus: input.defaultYieldBonus }
        : {}),
      ...(input.sellPriceType !== undefined
        ? { sellPriceType: input.sellPriceType }
        : {}),
      notes: input.notes ?? null,
    })
    .returning();
  return row;
}

/**
 * Partial update of a farm. Only the keys present in `patch` are written, so an
 * absent key leaves its column untouched. The `gameVersionId` change is the
 * caller's responsibility to wrap in a transaction together with
 * {@link remapFieldCropsBySlug}. Returns the updated row, or undefined if the id
 * is unknown (caller already established ownership via the farm-scope plugin).
 */
export interface UpdateFarmPatch {
  name?: string;
  gameVersionId?: string;
  mapName?: string | null;
  difficulty?: Difficulty;
  defaultYieldBonus?: number;
  sellPriceType?: SellPriceType;
  notes?: string | null;
}

export async function update(
  id: string,
  patch: UpdateFarmPatch,
  tx: DbExecutor = db,
): Promise<FarmRow | undefined> {
  const [row] = await tx
    .update(farms)
    .set(patch)
    .where(eq(farms.id, id))
    .returning();
  return row;
}

/**
 * Delete a farm. Fields, stables, machinery, animal_calculator_configs and
 * calculator_states are removed by the `ON DELETE CASCADE` FKs at the DB level.
 * Returns true if a row was deleted. Caller establishes ownership first.
 */
export async function remove(id: string, tx: DbExecutor = db): Promise<boolean> {
  const rows = await tx
    .delete(farms)
    .where(eq(farms.id, id))
    .returning({ id: farms.id });
  return rows.length > 0;
}

/** Derived counters exposed on the Farm response (not stored columns). */
export interface FarmCounts {
  fieldCount: number;
  stableCount: number;
}

/**
 * Count the fields and stables belonging to a farm via two COUNT subqueries.
 * Used to populate `fieldCount`/`stableCount` on the Farm response
 * (docs/base-de-datos.md §9).
 */
export async function countFieldsAndStables(
  farmId: string,
  tx: DbExecutor = db,
): Promise<FarmCounts> {
  const [fieldRows, stableRows] = await Promise.all([
    tx.select({ value: count() }).from(fields).where(eq(fields.farmId, farmId)),
    tx
      .select({ value: count() })
      .from(stables)
      .where(eq(stables.farmId, farmId)),
  ]);
  return {
    fieldCount: fieldRows[0]?.value ?? 0,
    stableCount: stableRows[0]?.value ?? 0,
  };
}

/**
 * Remap every assigned field crop from `oldGameVersionId` to
 * `newGameVersionId` by stable slug, used when a farm's `gameVersionId` changes
 * (docs/base-de-datos.md §9 business rules). For each field that has a `cropId`:
 *
 *   1. look up the crop's slug in the OLD version,
 *   2. find the crop with the same slug in the NEW version,
 *   3. if found, point the field at the new crop id; otherwise set `cropId` NULL
 *      and append a warning string for `meta.warnings`.
 *
 * MUST run inside the same transaction as the `farms.gameVersionId` update so
 * the change is atomic. Returns the list of human-readable warnings (empty when
 * every crop remapped cleanly).
 */
export async function remapFieldCropsBySlug(
  tx: DbExecutor,
  farmId: string,
  oldGameVersionId: string,
  newGameVersionId: string,
): Promise<string[]> {
  // Fields of this farm that currently have a crop assigned.
  const assigned = await tx
    .select({
      id: fields.id,
      fieldNumber: fields.fieldNumber,
      cropId: fields.cropId,
    })
    .from(fields)
    .where(and(eq(fields.farmId, farmId), isNotNull(fields.cropId)));

  if (assigned.length === 0) {
    return [];
  }

  // Slug catalog for the OLD version (id -> slug) and the NEW version
  // (slug -> id). Two small reads keep this O(catalog) instead of O(fields).
  const [oldCrops, newCrops] = await Promise.all([
    tx
      .select({ id: crops.id, slug: crops.slug })
      .from(crops)
      .where(eq(crops.gameVersionId, oldGameVersionId)),
    tx
      .select({ id: crops.id, slug: crops.slug })
      .from(crops)
      .where(eq(crops.gameVersionId, newGameVersionId)),
  ]);

  const slugByOldId = new Map(oldCrops.map((c) => [c.id, c.slug]));
  const idByNewSlug = new Map(newCrops.map((c) => [c.slug, c.id]));

  const warnings: string[] = [];

  for (const field of assigned) {
    // cropId is non-null here (filtered above), but narrow for TS.
    const currentCropId = field.cropId;
    if (currentCropId === null) continue;

    const slug = slugByOldId.get(currentCropId);

    // Unknown old crop id (data drift) → drop the assignment and warn.
    if (slug === undefined) {
      await tx
        .update(fields)
        .set({ cropId: null })
        .where(eq(fields.id, field.id));
      warnings.push(
        `Field ${field.fieldNumber}: previous crop is not part of the old game version; crop cleared.`,
      );
      continue;
    }

    const newCropId = idByNewSlug.get(slug);
    if (newCropId !== undefined) {
      await tx
        .update(fields)
        .set({ cropId: newCropId })
        .where(eq(fields.id, field.id));
    } else {
      await tx
        .update(fields)
        .set({ cropId: null })
        .where(eq(fields.id, field.id));
      warnings.push(
        `Field ${field.fieldNumber}: crop "${slug}" does not exist in the new game version; crop cleared.`,
      );
    }
  }

  return warnings;
}
