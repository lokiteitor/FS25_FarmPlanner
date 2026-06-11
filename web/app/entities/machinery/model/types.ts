// entities/machinery/model/types — domain shapes for a machine ("equipo"/
// maquinaria). Mirrors the `Machine` / `MachineCreate` / `MachineUpdate`
// schemas in docs/openapi.yaml (nested under /farms/:farmId/machinery).

/**
 * A piece of machinery belonging to a farm. `workingWidthM` and
 * `workingSpeedKmh` drive the work-speed calculator (ha/h throughput).
 */
export interface Machine {
  id: string
  farmId: string
  name: string
  /** Working width in metres. */
  workingWidthM: number
  /** Working speed in km/h. */
  workingSpeedKmh: number
  createdAt?: string
  updatedAt?: string
}

/** Body for `POST /farms/:farmId/machinery` (MachineCreate). */
export interface MachineCreate {
  name: string
  workingWidthM: number
  workingSpeedKmh: number
}

/** Body for `PATCH /farms/:farmId/machinery/:id` (MachineUpdate). All optional. */
export interface MachineUpdate {
  name?: string
  workingWidthM?: number
  workingSpeedKmh?: number
}
