/**
 * Data access for the `fields` table (H4.3).
 *
 * Every read/write is scoped to a farm (`farm_id = farmId`) so a field belonging
 * to another farm is simply not found — the service maps that to
 * `404 FIELD_NOT_FOUND`, never a 403 (ADR-005). Ownership of the farm itself is
 * established upstream by the farm-scope plugin; this repository only filters by
 * `farmId`. Per the layering rules all `fields` SQL lives here.
 *
 * Crop-coherence helpers live here too (a crop row by id, and a silage_crops
 * existence check by (gameVersionId, cropId)) so the service can validate the
 * two business rules from docs/base-de-datos.md §10 (CROP_VERSION_MISMATCH,
 * SILAGE_NOT_SUPPORTED_FOR_CROP) without reaching into the catalog tables itself.
 */

import { and, asc, eq } from 'drizzle-orm';

import { db, type DbExecutor } from '../db/client';
import { crops, fields, silageCrops } from '../db/schema';

export type FieldRow = typeof fields.$inferSelect;
export type CropRow = typeof crops.$inferSelect;

/**
 * Insert payload for a new field. `farmId` is passed separately by the service.
 * Optional columns map to nullable DB columns; `isSilage` carries its own value
 * (the schema defaults it to false before it reaches the service).
 */
export interface CreateFieldInput {
  fieldNumber: number;
  hectares: number;
  cropId?: string | null;
  isSilage: boolean;
  yieldBonus?: number | null;
  purchasePrice?: number | null;
}

/**
 * Partial update payload. Only the keys present are written, so an absent key
 * leaves its column untouched; a present `null` clears a nullable column.
 */
export interface UpdateFieldPatch {
  fieldNumber?: number;
  hectares?: number;
  cropId?: string | null;
  isSilage?: boolean;
  yieldBonus?: number | null;
  purchasePrice?: number | null;
}

/**
 * List a farm's fields ordered by `field_number` (the contract requires fields
 * ordered by fieldNumber; openapi.yaml listFields).
 */
export async function listByFarm(
  farmId: string,
  tx: DbExecutor = db,
): Promise<FieldRow[]> {
  return tx
    .select()
    .from(fields)
    .where(eq(fields.farmId, farmId))
    .orderBy(asc(fields.fieldNumber));
}

/**
 * Find a single field by id scoped to its farm. The `farm_id = farmId` filter is
 * part of the query, so a field in another farm is `undefined` (→ 404).
 */
export async function findById(
  id: string,
  farmId: string,
  tx: DbExecutor = db,
): Promise<FieldRow | undefined> {
  const rows = await tx
    .select()
    .from(fields)
    .where(and(eq(fields.id, id), eq(fields.farmId, farmId)))
    .limit(1);
  return rows[0];
}

/**
 * Create a field for a farm. The `fields_farm_number_unique` constraint enforces
 * the one-number-per-farm rule; the service may pre-check and the error-handler
 * maps the 23505 to `409 DUPLICATE_FIELD_NUMBER` as a race-safe fallback.
 */
export async function create(
  farmId: string,
  input: CreateFieldInput,
  tx: DbExecutor = db,
): Promise<FieldRow> {
  const [row] = await tx
    .insert(fields)
    .values({
      farmId,
      fieldNumber: input.fieldNumber,
      hectares: input.hectares,
      cropId: input.cropId ?? null,
      isSilage: input.isSilage,
      yieldBonus: input.yieldBonus ?? null,
      purchasePrice: input.purchasePrice ?? null,
    })
    .returning();
  return row;
}

/**
 * Partial update of a field scoped to its farm. Only the keys in `patch` are
 * written. Returns the updated row, or `undefined` if no row matched (unknown id
 * or a field belonging to another farm → 404). The `farm_id = farmId` filter
 * keeps the update scoped even though ownership was already established upstream.
 */
export async function update(
  id: string,
  farmId: string,
  patch: UpdateFieldPatch,
  tx: DbExecutor = db,
): Promise<FieldRow | undefined> {
  const [row] = await tx
    .update(fields)
    .set(patch)
    .where(and(eq(fields.id, id), eq(fields.farmId, farmId)))
    .returning();
  return row;
}

/**
 * Delete a field scoped to its farm. Returns true if a row was deleted (false →
 * unknown id or foreign field → 404). Caller establishes farm ownership first.
 */
export async function remove(
  id: string,
  farmId: string,
  tx: DbExecutor = db,
): Promise<boolean> {
  const rows = await tx
    .delete(fields)
    .where(and(eq(fields.id, id), eq(fields.farmId, farmId)))
    .returning({ id: fields.id });
  return rows.length > 0;
}

/**
 * Fetch a crop row by id (or `undefined`). Used by the service to validate the
 * crop↔version coherence rule: the crop must belong to the farm's game version
 * (docs/base-de-datos.md §10). Reading the crop here keeps all `crops` access in
 * a repository.
 */
export async function findCropById(
  cropId: string,
  tx: DbExecutor = db,
): Promise<CropRow | undefined> {
  const rows = await tx
    .select()
    .from(crops)
    .where(eq(crops.id, cropId))
    .limit(1);
  return rows[0];
}

/**
 * Whether a crop is available as a silage crop for a given game version
 * (i.e. a row exists in `silage_crops` for that `(gameVersionId, cropId)`).
 * Backs the `is_silage = true` business rule (SILAGE_NOT_SUPPORTED_FOR_CROP).
 */
export async function silageCropExists(
  gameVersionId: string,
  cropId: string,
  tx: DbExecutor = db,
): Promise<boolean> {
  const rows = await tx
    .select({ id: silageCrops.id })
    .from(silageCrops)
    .where(
      and(
        eq(silageCrops.gameVersionId, gameVersionId),
        eq(silageCrops.cropId, cropId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
