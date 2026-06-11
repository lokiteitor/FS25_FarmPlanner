import type { FarmRow } from '../repositories/farms.repository';
import * as machineryRepo from '../repositories/machinery.repository';
import type { MachineRow } from '../repositories/machinery.repository';
import type {
  MachineCreateInput,
  MachineUpdateInput,
  MachineDto,
} from '../schemas/machinery';
import { NotFoundError } from '../lib/errors';

/**
 * Machinery service (H4.4): business rules for `/farms/:farmId/machinery`.
 *
 * The route layer has already authorised the farm (farm-scope plugin →
 * `request.farm`), so every method takes the resolved `farm`. Machinery has no
 * name uniqueness and no cross-resource coherence rules (docs/base-de-datos.md
 * §12), so the service is mostly mapping plus 404-on-missing for item ops; the
 * positive-number constraints are enforced by the zod body schemas and the DB
 * CHECKs. Domain errors are thrown as AppError subclasses and formatted by the
 * error-handler plugin.
 */

/** Map a machinery row to the Machine DTO (timestamps → ISO strings). */
function toDto(row: MachineRow): MachineDto {
  return {
    id: row.id,
    farmId: row.farmId,
    name: row.name,
    workingWidthM: row.workingWidthM,
    workingSpeedKmh: row.workingSpeedKmh,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** List the machinery of a farm. */
export async function list(farm: FarmRow): Promise<MachineDto[]> {
  const rows = await machineryRepo.listByFarm(farm.id);
  return rows.map(toDto);
}

/** Get one machine of a farm (→ 404 MACHINE_NOT_FOUND if absent/cross-farm). */
export async function get(farm: FarmRow, machineId: string): Promise<MachineDto> {
  const row = await machineryRepo.findById(machineId, farm.id);
  if (!row) {
    throw new NotFoundError('MACHINE_NOT_FOUND', 'Equipo no encontrado');
  }
  return toDto(row);
}

/** Create a machine in a farm. */
export async function create(
  farm: FarmRow,
  input: MachineCreateInput,
): Promise<MachineDto> {
  const row = await machineryRepo.create(farm.id, {
    name: input.name,
    workingWidthM: input.workingWidthM,
    workingSpeedKmh: input.workingSpeedKmh,
  });
  return toDto(row);
}

/** Update a machine in a farm (partial). */
export async function update(
  farm: FarmRow,
  machineId: string,
  patch: MachineUpdateInput,
): Promise<MachineDto> {
  const repoPatch: machineryRepo.UpdateMachinePatch = {};
  if (patch.name !== undefined) repoPatch.name = patch.name;
  if (patch.workingWidthM !== undefined) {
    repoPatch.workingWidthM = patch.workingWidthM;
  }
  if (patch.workingSpeedKmh !== undefined) {
    repoPatch.workingSpeedKmh = patch.workingSpeedKmh;
  }

  // Empty patch: nothing to write, but still 404 if the machine is gone.
  if (Object.keys(repoPatch).length === 0) {
    return get(farm, machineId);
  }

  const row = await machineryRepo.update(machineId, farm.id, repoPatch);
  if (!row) {
    throw new NotFoundError('MACHINE_NOT_FOUND', 'Equipo no encontrado');
  }
  return toDto(row);
}

/** Delete a machine in a farm (→ 404 if absent/cross-farm). */
export async function remove(farm: FarmRow, machineId: string): Promise<void> {
  const deleted = await machineryRepo.remove(machineId, farm.id);
  if (!deleted) {
    throw new NotFoundError('MACHINE_NOT_FOUND', 'Equipo no encontrado');
  }
}
