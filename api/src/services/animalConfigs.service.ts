/**
 * AnimalConfigs service (H4.5): business logic for per-species calculator
 * configs, one per (farm, species).
 *
 * Responsibilities and boundaries:
 *  - Orchestrates the animalConfigs + catalog repositories; ALL DB access goes
 *    through repositories (layered architecture).
 *  - Ownership is already enforced by the farm-scope plugin (caller passes the
 *    resolved `farm`); every repository call is scoped by `farm.id`.
 *  - Validates the PUT body with the species discriminated union and enforces
 *    that the body's `species` equals the route's `{species}` (else 422
 *    VALIDATION_ERROR). The route already zod-validates the body, but the service
 *    re-checks species coherence because that cross-field rule depends on the
 *    path param.
 *  - Slug fields inside `inputs` (silage / grown / feed-component crops) are
 *    validated against the farm's game-version crop catalog where it makes sense
 *    (docs/base-de-datos.md §13). Unknown slugs → 422 CROP_VERSION_MISMATCH.
 *  - Maps rows to the AnimalConfig DTO (timestamps as ISO strings).
 *
 * Throws domain {@link AppError}s; the error-handler plugin formats them.
 */

import { ValidationError, NotFoundError, UnprocessableError } from '../lib/errors';
import type { ErrorDetail } from '../lib/errors';
import type { FarmRow } from '../repositories/farms.repository';
import * as animalConfigsRepo from '../repositories/animalConfigs.repository';
import type { AnimalConfigRow } from '../repositories/animalConfigs.repository';
import * as catalogRepo from '../repositories/catalog.repository';
import type { AnimalSpecies } from '../db/schema/enums';
import {
  animalConfigInputsSchema,
  type AnimalConfigDto,
  type AnimalConfigInputs,
} from '../schemas/animalConfigs';

/** Result of an upsert: the DTO plus whether the row was freshly created. */
export interface UpsertOutcome {
  config: AnimalConfigDto;
  created: boolean;
}

/** Map a persisted row to the AnimalConfig DTO (timestamps → ISO strings). */
function toDto(row: AnimalConfigRow): AnimalConfigDto {
  return {
    id: row.id,
    farmId: row.farmId,
    species: row.species,
    schemaVersion: row.schemaVersion,
    // `inputs` was validated by the species union on write, so it conforms to
    // the DTO shape; the column type is a generic record, hence the assertion.
    inputs: row.inputs as AnimalConfigInputs,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** GET /farms/{farmId}/animal-configs → every saved config (0..7). */
export async function list(farm: FarmRow): Promise<AnimalConfigDto[]> {
  const rows = await animalConfigsRepo.listByFarm(farm.id);
  return rows.map(toDto);
}

/**
 * GET /farms/{farmId}/animal-configs/{species} → the saved config, or
 * `404 CONFIG_NOT_FOUND` when none exists (the client uses catalog defaults).
 */
export async function get(
  farm: FarmRow,
  species: AnimalSpecies,
): Promise<AnimalConfigDto> {
  const row = await animalConfigsRepo.findBySpecies(farm.id, species);
  if (!row) {
    throw new NotFoundError(
      'CONFIG_NOT_FOUND',
      'No saved configuration for this species',
    );
  }
  return toDto(row);
}

/**
 * Collect every crop-slug reference inside an inputs object that should be
 * checked against the catalog. `silageCrop` may be null (cleared); nulls and
 * absent fields are skipped. Returns `[field, slug]` pairs so a bad slug reports
 * the exact offending field.
 */
function collectSlugRefs(inputs: AnimalConfigInputs): Array<[string, string]> {
  const refs: Array<[string, string]> = [];
  const push = (field: string, value: unknown): void => {
    if (typeof value === 'string' && value.length > 0) {
      refs.push([field, value]);
    }
  };

  switch (inputs.species) {
    case 'cow':
    case 'buffalo':
      push('silageCrop', inputs.silageCrop);
      break;
    case 'chicken':
      push('grownCrop', inputs.grownCrop);
      break;
    case 'pig':
      push('baseCrop', inputs.baseCrop);
      push('grainCrop', inputs.grainCrop);
      push('proteinCrop', inputs.proteinCrop);
      push('rootCrop', inputs.rootCrop);
      break;
    case 'horse':
      push('baseCrop', inputs.baseCrop);
      push('rootCrop', inputs.rootCrop);
      break;
    case 'sheep':
    case 'goat':
      // No crop-slug fields.
      break;
  }
  return refs;
}

/**
 * Validate that every crop slug referenced in `inputs` exists in the farm's
 * game-version crop catalog. Unknown slugs → 422 CROP_VERSION_MISMATCH with a
 * detail per offending field. Skips the catalog read entirely when there are no
 * slug references.
 */
async function validateCropSlugs(
  farm: FarmRow,
  inputs: AnimalConfigInputs,
): Promise<void> {
  const refs = collectSlugRefs(inputs);
  if (refs.length === 0) return;

  const crops = await catalogRepo.listCrops(farm.gameVersionId);
  const known = new Set(crops.map((c) => c.slug));

  const details: ErrorDetail[] = [];
  for (const [field, slug] of refs) {
    if (!known.has(slug)) {
      details.push({
        path: field,
        message: `Crop "${slug}" does not belong to the farm's game version`,
      });
    }
  }

  if (details.length > 0) {
    throw new UnprocessableError(
      'CROP_VERSION_MISMATCH',
      "Crop does not belong to the farm's game version",
      details,
    );
  }
}

/**
 * PUT /farms/{farmId}/animal-configs/{species} — create or replace the config.
 *
 * Steps:
 *  1. Validate the raw body against the species discriminated union (also done
 *     at the route layer, but re-checked so the service is safe in isolation).
 *  2. Enforce `body.species === pathSpecies` (cross-field rule depending on the
 *     path) → 422 VALIDATION_ERROR.
 *  3. Validate crop slugs against the farm catalog → 422 CROP_VERSION_MISMATCH.
 *  4. Pre-check existence to answer 200 (replaced) vs 201 (created), then upsert.
 */
export async function upsert(
  farm: FarmRow,
  pathSpecies: AnimalSpecies,
  body: unknown,
): Promise<UpsertOutcome> {
  const parsed = animalConfigInputsSchema.safeParse(body);
  if (!parsed.success) {
    const details: ErrorDetail[] = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError(details);
  }
  const inputs = parsed.data;

  if (inputs.species !== pathSpecies) {
    throw new ValidationError([
      {
        path: 'species',
        message: `Body species "${inputs.species}" must match path species "${pathSpecies}"`,
      },
    ]);
  }

  await validateCropSlugs(farm, inputs);

  // Pre-check for a reliable 201 (created) vs 200 (replaced) distinction.
  const existing = await animalConfigsRepo.findBySpecies(farm.id, pathSpecies);
  const { row } = await animalConfigsRepo.upsert(farm.id, pathSpecies, inputs);

  return { config: toDto(row), created: existing === undefined };
}

/**
 * DELETE /farms/{farmId}/animal-configs/{species} → 204. Idempotent in spirit,
 * but the contract surfaces a missing config as 404 CONFIG_NOT_FOUND.
 */
export async function remove(
  farm: FarmRow,
  species: AnimalSpecies,
): Promise<void> {
  const deleted = await animalConfigsRepo.remove(farm.id, species);
  if (!deleted) {
    throw new NotFoundError(
      'CONFIG_NOT_FOUND',
      'No saved configuration for this species',
    );
  }
}
