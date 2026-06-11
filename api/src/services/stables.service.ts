import { ZodError } from 'zod';

import type { FarmRow } from '../repositories/farms.repository';
import * as stablesRepo from '../repositories/stables.repository';
import type { StableRow } from '../repositories/stables.repository';
import * as catalogRepo from '../repositories/catalog.repository';
import {
  stableConfigSchema,
  configSlugRefs,
  type StableCreateInput,
  type StableUpdateInput,
  type StableDto,
} from '../schemas/stables';
import { NotFoundError, ConflictError, UnprocessableError } from '../lib/errors';
import type { ErrorDetail } from '../lib/errors';
import type { AnimalSpecies } from '../db/schema/enums';

/**
 * Stables service (H4.4): business rules for `/farms/:farmId/stables`.
 *
 * The route layer has already authorised the farm (farm-scope plugin →
 * `request.farm`), so every method takes the resolved `farm`. Responsibilities:
 *
 *   - validate `config` against the stable's species (strict zod; rejects
 *     unknown keys and the farm-level `difficulty`/`sellPriceType` keys),
 *   - validate crop/silage slug references in `config` against the farm's
 *     catalog version (so a typo'd or wrong-version slug fails fast),
 *   - enforce `currentCount <= maxCapacity` with a friendly
 *     `422 COUNT_EXCEEDS_CAPACITY` before the DB CHECK constraint fires,
 *   - pre-check the per-farm name uniqueness for a clean `409
 *     DUPLICATE_STABLE_NAME` (the error-handler's 23505 mapping is the race-safe
 *     backstop),
 *   - map rows to the API DTO.
 *
 * Domain errors are thrown as AppError subclasses and formatted by the
 * error-handler plugin.
 */

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/** Map a stables row to the Stable DTO (timestamps → ISO strings). */
function toDto(row: StableRow): StableDto {
  return {
    id: row.id,
    farmId: row.farmId,
    name: row.name,
    species: row.species,
    maxCapacity: row.maxCapacity,
    currentCount: row.currentCount,
    config: row.config,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate a raw `config` object against the species' strict schema. Returns the
 * parsed config. A schema mismatch (unknown key, wrong feedType, a forbidden
 * `difficulty`/`sellPriceType` key…) surfaces as `422 VALIDATION_ERROR` with the
 * offending paths under `config`.
 */
function validateConfig(
  species: AnimalSpecies,
  config: Record<string, unknown>,
): Record<string, unknown> {
  try {
    return stableConfigSchema(species).parse(config);
  } catch (err) {
    if (err instanceof ZodError) {
      const details: ErrorDetail[] = err.issues.map((issue) => ({
        path: ['config', ...issue.path].join('.'),
        message: issue.message,
      }));
      throw new UnprocessableError(
        'VALIDATION_ERROR',
        'Configuración de establo inválida para la especie',
        details,
      );
    }
    throw err;
  }
}

/**
 * Validate the crop/silage slug references in a parsed config against the farm's
 * catalog version. A `silageCrop` must additionally exist in the version's silage
 * catalog (`422 SILAGE_NOT_SUPPORTED_FOR_CROP`); the component crop slugs
 * (base/grain/protein/root) must exist as crops in the version (`422
 * CROP_VERSION_MISMATCH`).
 */
async function validateConfigSlugs(
  farm: FarmRow,
  config: Record<string, unknown>,
): Promise<void> {
  const refs = configSlugRefs(config);
  if (refs.length === 0) return;

  const [crops, silageCrops] = await Promise.all([
    catalogRepo.listCrops(farm.gameVersionId),
    catalogRepo.listSilageCrops(farm.gameVersionId),
  ]);
  const cropSlugs = new Set(crops.map((c) => c.slug));
  const silageSlugs = new Set(silageCrops.map((c) => c.cropSlug));

  for (const ref of refs) {
    if (ref.key === 'silageCrop') {
      // The silage crop must be both a known crop and silage-capable.
      if (!cropSlugs.has(ref.slug)) {
        throw new UnprocessableError(
          'CROP_VERSION_MISMATCH',
          `El cultivo "${ref.slug}" no pertenece a la versión de la partida`,
          [{ path: `config.${ref.key}`, message: 'crop not in game version' }],
        );
      }
      if (!silageSlugs.has(ref.slug)) {
        throw new UnprocessableError(
          'SILAGE_NOT_SUPPORTED_FOR_CROP',
          `El cultivo "${ref.slug}" no admite ensilaje`,
          [{ path: `config.${ref.key}`, message: 'crop has no silage variant' }],
        );
      }
    } else if (!cropSlugs.has(ref.slug)) {
      throw new UnprocessableError(
        'CROP_VERSION_MISMATCH',
        `El cultivo "${ref.slug}" no pertenece a la versión de la partida`,
        [{ path: `config.${ref.key}`, message: 'crop not in game version' }],
      );
    }
  }
}

/**
 * Enforce `currentCount <= maxCapacity` with a friendly 422 before the DB CHECK.
 */
function assertWithinCapacity(currentCount: number, maxCapacity: number): void {
  if (currentCount > maxCapacity) {
    throw new UnprocessableError(
      'COUNT_EXCEEDS_CAPACITY',
      'currentCount supera maxCapacity',
      [
        {
          path: 'currentCount',
          message: `currentCount (${currentCount}) must not exceed maxCapacity (${maxCapacity})`,
        },
      ],
    );
  }
}

/**
 * Pre-check the per-farm name uniqueness for a clean 409. The DB unique
 * constraint (`stables_farm_name_unique`) is the authoritative, race-safe guard;
 * `excludeId` lets PATCH ignore the row being updated.
 */
async function assertNameAvailable(
  farmId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  const existing = await stablesRepo.listByFarm(farmId);
  const clash = existing.find((s) => s.name === name && s.id !== excludeId);
  if (clash) {
    throw new ConflictError(
      'DUPLICATE_STABLE_NAME',
      'Nombre de establo duplicado en la partida',
    );
  }
}

// ---------------------------------------------------------------------------
// Use cases
// ---------------------------------------------------------------------------

/** List the stables of a farm. */
export async function list(farm: FarmRow): Promise<StableDto[]> {
  const rows = await stablesRepo.listByFarm(farm.id);
  return rows.map(toDto);
}

/** Get one stable of a farm (→ 404 STABLE_NOT_FOUND if absent/cross-farm). */
export async function get(farm: FarmRow, stableId: string): Promise<StableDto> {
  const row = await stablesRepo.findById(stableId, farm.id);
  if (!row) {
    throw new NotFoundError('STABLE_NOT_FOUND', 'Establo no encontrado');
  }
  return toDto(row);
}

/** Create a stable in a farm. */
export async function create(
  farm: FarmRow,
  input: StableCreateInput,
): Promise<StableDto> {
  const config = validateConfig(input.species, input.config ?? {});
  await validateConfigSlugs(farm, config);

  // currentCount defaults to 0 at the schema layer.
  assertWithinCapacity(input.currentCount, input.maxCapacity);
  await assertNameAvailable(farm.id, input.name);

  const row = await stablesRepo.create(farm.id, {
    name: input.name,
    species: input.species,
    maxCapacity: input.maxCapacity,
    currentCount: input.currentCount,
    config,
  });
  return toDto(row);
}

/** Update a stable in a farm (partial). */
export async function update(
  farm: FarmRow,
  stableId: string,
  patch: StableUpdateInput,
): Promise<StableDto> {
  const current = await stablesRepo.findById(stableId, farm.id);
  if (!current) {
    throw new NotFoundError('STABLE_NOT_FOUND', 'Establo no encontrado');
  }

  // Effective species/capacity/count after applying the patch, for cross-field
  // checks (config is validated against the resulting species; capacity check
  // uses whichever of count/capacity ends up in effect).
  const species = patch.species ?? current.species;
  const maxCapacity = patch.maxCapacity ?? current.maxCapacity;
  const currentCount = patch.currentCount ?? current.currentCount;

  const repoPatch: stablesRepo.UpdateStablePatch = {};

  if (patch.name !== undefined) repoPatch.name = patch.name;
  if (patch.species !== undefined) repoPatch.species = patch.species;
  if (patch.maxCapacity !== undefined) repoPatch.maxCapacity = patch.maxCapacity;
  if (patch.currentCount !== undefined) {
    repoPatch.currentCount = patch.currentCount;
  }

  // Re-validate config whenever config OR species changes (a species change can
  // invalidate the existing stored config). Validate against the effective
  // species using the incoming config when present, else the stored one.
  if (patch.config !== undefined || patch.species !== undefined) {
    const rawConfig = patch.config ?? current.config;
    const config = validateConfig(species, rawConfig);
    await validateConfigSlugs(farm, config);
    repoPatch.config = config;
  }

  // Capacity check applies when either side changes (or always — cheap).
  assertWithinCapacity(currentCount, maxCapacity);

  if (patch.name !== undefined) {
    await assertNameAvailable(farm.id, patch.name, stableId);
  }

  // Empty patch: nothing to write; return the row already read.
  if (Object.keys(repoPatch).length === 0) {
    return toDto(current);
  }

  const row = await stablesRepo.update(stableId, farm.id, repoPatch);
  if (!row) {
    // Lost between the read and the write (deleted concurrently).
    throw new NotFoundError('STABLE_NOT_FOUND', 'Establo no encontrado');
  }
  return toDto(row);
}

/** Delete a stable in a farm (→ 404 if absent/cross-farm). */
export async function remove(farm: FarmRow, stableId: string): Promise<void> {
  const deleted = await stablesRepo.remove(stableId, farm.id);
  if (!deleted) {
    throw new NotFoundError('STABLE_NOT_FOUND', 'Establo no encontrado');
  }
}
