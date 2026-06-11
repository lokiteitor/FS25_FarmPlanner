/**
 * Fields service (H4.3): the field CRUD use-cases for `/farms/{farmId}/fields`.
 *
 * Responsibilities and boundaries:
 *  - Orchestrates the fields repository; ALL DB access goes through repositories
 *    (layered architecture), never raw queries here.
 *  - Enforces the two business rules from docs/base-de-datos.md §10 that the FK
 *    cannot express:
 *      1. Crop↔version coherence — an assigned crop MUST belong to the farm's
 *         game version (crop.gameVersionId === farm.gameVersionId), else
 *         `422 CROP_VERSION_MISMATCH`.
 *      2. Silage support — `isSilage = true` requires an assigned crop that
 *         exists in `silage_crops` for the farm's version, else
 *         `422 SILAGE_NOT_SUPPORTED_FOR_CROP`.
 *    `cropId = null` clears the crop (allowed). Silage with no crop is a silage
 *    violation (you cannot project silage without a crop).
 *  - Ownership of the farm is established upstream by the farm-scope plugin; the
 *    `farm` row is passed in by the controller. Field-level not-found is the
 *    repository returning `undefined`/false → `404 FIELD_NOT_FOUND` (never 403).
 *  - The unique `(farm_id, field_number)` constraint is the source of truth for
 *    duplicate detection; the DB 23505 is mapped to `409 DUPLICATE_FIELD_NUMBER`
 *    by the error-handler as a race-safe backstop (no pre-check needed here).
 *
 * Throws domain {@link AppError}s; the error-handler plugin renders them.
 */

import { NotFoundError, UnprocessableError } from '../lib/errors';
import type { FarmRow } from '../repositories/farms.repository';
import * as fieldsRepo from '../repositories/fields.repository';
import type { FieldRow } from '../repositories/fields.repository';
import type { FieldCreateInput, FieldUpdateInput } from '../schemas/fields';

/**
 * Validate the crop-coherence + silage business rules for a field's effective
 * `(cropId, isSilage)` against the farm's game version.
 *
 *  - `cropId === null`: no crop assigned. `isSilage` must be false — silage with
 *    no crop has nothing to ensile → SILAGE_NOT_SUPPORTED_FOR_CROP.
 *  - `cropId` set: the crop must exist and belong to `farm.gameVersionId`
 *    (else CROP_VERSION_MISMATCH); if `isSilage`, a silage_crops row must exist
 *    for that version (else SILAGE_NOT_SUPPORTED_FOR_CROP).
 */
async function assertCropRules(
  farm: FarmRow,
  cropId: string | null,
  isSilage: boolean,
): Promise<void> {
  if (cropId === null) {
    if (isSilage) {
      throw new UnprocessableError(
        'SILAGE_NOT_SUPPORTED_FOR_CROP',
        'El ensilaje requiere un cultivo asignado',
      );
    }
    return;
  }

  const crop = await fieldsRepo.findCropById(cropId);
  if (!crop || crop.gameVersionId !== farm.gameVersionId) {
    // Both "unknown crop" and "crop of another version" collapse to the same
    // coherence error: from the farm's point of view the crop is not part of
    // its game version.
    throw new UnprocessableError(
      'CROP_VERSION_MISMATCH',
      'El cultivo no pertenece a la versión de la partida',
    );
  }

  if (isSilage) {
    const supported = await fieldsRepo.silageCropExists(
      farm.gameVersionId,
      cropId,
    );
    if (!supported) {
      throw new UnprocessableError(
        'SILAGE_NOT_SUPPORTED_FOR_CROP',
        'El cultivo no admite ensilaje',
      );
    }
  }
}

/** List a farm's fields ordered by fieldNumber. */
export async function list(farm: FarmRow): Promise<FieldRow[]> {
  return fieldsRepo.listByFarm(farm.id);
}

/** Fetch one field of a farm, or `404 FIELD_NOT_FOUND` if it doesn't exist. */
export async function get(farm: FarmRow, fieldId: string): Promise<FieldRow> {
  const field = await fieldsRepo.findById(fieldId, farm.id);
  if (!field) {
    throw new NotFoundError('FIELD_NOT_FOUND');
  }
  return field;
}

/**
 * Create a field. Validates the crop/silage rules against the farm's version
 * before inserting; the unique `(farm_id, field_number)` constraint guards
 * duplicates (→ 409 DUPLICATE_FIELD_NUMBER via the error-handler).
 */
export async function create(
  farm: FarmRow,
  input: FieldCreateInput,
): Promise<FieldRow> {
  const cropId = input.cropId ?? null;
  await assertCropRules(farm, cropId, input.isSilage);

  return fieldsRepo.create(farm.id, {
    fieldNumber: input.fieldNumber,
    hectares: input.hectares,
    cropId,
    isSilage: input.isSilage,
    yieldBonus: input.yieldBonus,
    purchasePrice: input.purchasePrice,
  });
}

/**
 * Update a field. The crop/silage rules are validated against the EFFECTIVE
 * post-patch `(cropId, isSilage)` — i.e. the patched values merged onto the
 * existing row — so e.g. flipping `isSilage` on a field that already has a
 * non-silage crop is correctly rejected. Re-validates only when crop or silage
 * could change; otherwise the existing values already satisfy the rules.
 */
export async function update(
  farm: FarmRow,
  fieldId: string,
  patch: FieldUpdateInput,
): Promise<FieldRow> {
  const existing = await get(farm, fieldId);

  const cropTouched = patch.cropId !== undefined;
  const silageTouched = patch.isSilage !== undefined;

  if (cropTouched || silageTouched) {
    const effectiveCropId = cropTouched
      ? (patch.cropId ?? null)
      : (existing.cropId ?? null);
    const effectiveIsSilage = silageTouched
      ? patch.isSilage!
      : existing.isSilage;
    await assertCropRules(farm, effectiveCropId, effectiveIsSilage);
  }

  const updated = await fieldsRepo.update(fieldId, farm.id, patch);
  if (!updated) {
    // Established existence above; a miss here means it vanished concurrently.
    throw new NotFoundError('FIELD_NOT_FOUND');
  }
  return updated;
}

/** Delete a field, or `404 FIELD_NOT_FOUND` if it doesn't exist in the farm. */
export async function remove(farm: FarmRow, fieldId: string): Promise<void> {
  const deleted = await fieldsRepo.remove(fieldId, farm.id);
  if (!deleted) {
    throw new NotFoundError('FIELD_NOT_FOUND');
  }
}
