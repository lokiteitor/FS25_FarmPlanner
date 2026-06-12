import type { FarmRow } from '../repositories/farms.repository';
import * as buildingsRepo from '../repositories/productionBuildings.repository';
import type { ProductionBuildingRow } from '../repositories/productionBuildings.repository';
import {
  userChainSchema,
  type ProductionBuildingCreateInput,
  type ProductionBuildingUpdateInput,
  type ProductionBuildingDto,
  type UserChainValue,
} from '../schemas/productionBuildings';
import { NotFoundError, ConflictError, UnprocessableError } from '../lib/errors';
import type { ErrorDetail } from '../lib/errors';

/**
 * Production Buildings service.
 *
 * The farm-scope plugin has already authorised the farm (`request.farm`), so
 * every method takes the resolved `FarmRow`. Responsibilities:
 *
 *   - Validate the `chains` array with the per-chain zod schema (strict mode
 *     rejects unknown keys; custom chains require all runtime fields).
 *   - Pre-check per-farm name uniqueness → 409 DUPLICATE_PRODUCTION_BUILDING_NAME.
 *   - Map rows to the API DTO.
 *
 * Domain errors bubble up to the error-handler plugin.
 */

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/** Map a production_buildings row to the DTO (timestamps → ISO strings). */
function toDto(row: ProductionBuildingRow): ProductionBuildingDto {
  return {
    id: row.id,
    farmId: row.farmId,
    name: row.name,
    buildingTypeSlug: row.buildingTypeSlug,
    chains: row.chains as unknown as Record<string, unknown>[],
    notes: row.notes ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate the `chains` array. Each element must satisfy `userChainSchema`;
 * chain ids must be unique within the building.
 */
function validateChains(
  raw: unknown[] | undefined,
): UserChainValue[] {
  if (!raw || raw.length === 0) return [];

  const validated: UserChainValue[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const result = userChainSchema.safeParse(raw[i]);
    if (!result.success) {
      const details: ErrorDetail[] = result.error.issues.map((issue) => ({
        path: [`chains[${i}]`, ...issue.path].join('.'),
        message: issue.message,
      }));
      throw new UnprocessableError(
        'VALIDATION_ERROR',
        `Receta de cadena inválida en la posición ${i}`,
        details,
      );
    }
    const chain = result.data;
    if (seenIds.has(chain.id)) {
      throw new UnprocessableError(
        'DUPLICATE_CHAIN_ID',
        `El id de cadena "${chain.id}" está duplicado en el mismo edificio`,
        [{ path: `chains[${i}].id`, message: 'duplicate chain id' }],
      );
    }
    seenIds.add(chain.id);
    validated.push(chain);
  }

  return validated;
}

/**
 * Pre-check per-farm name uniqueness → 409 DUPLICATE_PRODUCTION_BUILDING_NAME.
 * The DB unique constraint is the race-safe backstop.
 */
async function assertNameAvailable(
  farmId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  const existing = await buildingsRepo.listByFarm(farmId);
  const clash = existing.find((b) => b.name === name && b.id !== excludeId);
  if (clash) {
    throw new ConflictError(
      'DUPLICATE_PRODUCTION_BUILDING_NAME',
      'Nombre de edificio duplicado en la partida',
    );
  }
}

// ---------------------------------------------------------------------------
// Use cases
// ---------------------------------------------------------------------------

/** List the production buildings of a farm. */
export async function list(farm: FarmRow): Promise<ProductionBuildingDto[]> {
  const rows = await buildingsRepo.listByFarm(farm.id);
  return rows.map(toDto);
}

/** Get one production building of a farm (→ 404 if absent or cross-farm). */
export async function get(
  farm: FarmRow,
  buildingId: string,
): Promise<ProductionBuildingDto> {
  const row = await buildingsRepo.findById(buildingId, farm.id);
  if (!row) {
    throw new NotFoundError(
      'PRODUCTION_BUILDING_NOT_FOUND',
      'Edificio de producción no encontrado',
    );
  }
  return toDto(row);
}

/** Create a production building in a farm. */
export async function create(
  farm: FarmRow,
  input: ProductionBuildingCreateInput,
): Promise<ProductionBuildingDto> {
  const chains = validateChains(input.chains as unknown[] | undefined);
  await assertNameAvailable(farm.id, input.name);

  const row = await buildingsRepo.create(farm.id, {
    name: input.name,
    buildingTypeSlug: input.buildingTypeSlug,
    chains,
    notes: input.notes ?? null,
  });
  return toDto(row);
}

/** Update a production building in a farm (partial PATCH). */
export async function update(
  farm: FarmRow,
  buildingId: string,
  patch: ProductionBuildingUpdateInput,
): Promise<ProductionBuildingDto> {
  const current = await buildingsRepo.findById(buildingId, farm.id);
  if (!current) {
    throw new NotFoundError(
      'PRODUCTION_BUILDING_NOT_FOUND',
      'Edificio de producción no encontrado',
    );
  }

  const repoPatch: buildingsRepo.UpdateProductionBuildingPatch = {};

  if (patch.name !== undefined) {
    await assertNameAvailable(farm.id, patch.name, buildingId);
    repoPatch.name = patch.name;
  }
  if (patch.buildingTypeSlug !== undefined) {
    repoPatch.buildingTypeSlug = patch.buildingTypeSlug;
  }
  if (patch.chains !== undefined) {
    repoPatch.chains = validateChains(patch.chains as unknown[]);
  }
  if (patch.notes !== undefined) {
    repoPatch.notes = patch.notes;
  }

  if (Object.keys(repoPatch).length === 0) {
    return toDto(current);
  }

  const row = await buildingsRepo.update(buildingId, farm.id, repoPatch);
  if (!row) {
    throw new NotFoundError(
      'PRODUCTION_BUILDING_NOT_FOUND',
      'Edificio de producción no encontrado',
    );
  }
  return toDto(row);
}

/** Delete a production building in a farm (→ 404 if absent or cross-farm). */
export async function remove(farm: FarmRow, buildingId: string): Promise<void> {
  const deleted = await buildingsRepo.remove(buildingId, farm.id);
  if (!deleted) {
    throw new NotFoundError(
      'PRODUCTION_BUILDING_NOT_FOUND',
      'Edificio de producción no encontrado',
    );
  }
}
