// shared/lib/engine/workSpeedEngine — PURE work-time (speed) projection (H7.6).
//
// No stores, no network: every function takes plain inputs and returns plain
// results, so the page (pages/speed-calculator.vue) wires the machinery store
// to these functions. Reconstructed from standard FS25 fieldwork-throughput
// semantics (the prototype is unavailable); every formula assumption is
// documented inline.
//
// ── Formula reference ────────────────────────────────────────────────────────
//   capacityHaPerH(W, v)        = W * v / 10
//     A tool of width W (m) advancing at v (km/h) sweeps a strip of
//     W * (v * 1000 m/h) = W * v * 1000 m² per hour. Converting m² → ha
//     (÷10 000) gives W * v * 1000 / 10 000 = W * v / 10 ha/h. The documented
//     "/10" therefore folds the metre→kilometre and m²→hectare conversions
//     together. (Idealized 100% field coverage; real losses are captured by the
//     separate `efficiency` factor below.)
//   effectiveCapacity(machine)  = capacityHaPerH * efficiency
//   teamCapacity                = Σ effectiveCapacity over the selected machines
//     Several machines on the SAME field in parallel add their throughputs.
//   workHours                   = hectares / teamCapacity   (teamCapacity 0 ⇒ null)
//
// `efficiency` (WorkSpeedState.efficiency, range 0.5..1) discounts nameplate
// throughput for turning at headlands, overlap, refills, etc. It is clamped to
// [0.5, 1] defensively even though the API also validates the range.

import type {
  SpeedMachineBreakdown,
  SpeedMachineInput,
  WorkSpeedInput,
  WorkSpeedResult,
} from './types'

/** WorkSpeedState.efficiency bounds (docs/openapi.yaml WorkSpeedState). */
export const MIN_EFFICIENCY = 0.5
export const MAX_EFFICIENCY = 1

/**
 * Nameplate field throughput in ha/h for a tool of `workingWidthM` metres
 * advancing at `workingSpeedKmh` km/h. Returns 0 for non-positive inputs (a
 * machine with zero width or speed does no work).
 */
export function capacityHaPerH(workingWidthM: number, workingSpeedKmh: number): number {
  if (workingWidthM <= 0 || workingSpeedKmh <= 0) return 0
  return (workingWidthM * workingSpeedKmh) / 10
}

/**
 * Clamp an efficiency factor into the valid [0.5, 1] window. `NaN` (e.g. an
 * empty/garbled input) falls back to the minimum; ±Infinity clamp to the
 * window bounds like any out-of-range number.
 */
export function clampEfficiency(efficiency: number): number {
  if (Number.isNaN(efficiency)) return MIN_EFFICIENCY
  return Math.min(MAX_EFFICIENCY, Math.max(MIN_EFFICIENCY, efficiency))
}

/**
 * Project the total work time and per-machine breakdown for working `hectares`
 * with the `machines` team at `efficiency`.
 *
 * - `efficiency` is clamped to [0.5, 1].
 * - Machines work the same field in parallel: their post-efficiency throughputs
 *   sum into the team rate.
 * - When the team has zero throughput (no machines, or all zero-capacity), or
 *   `hectares <= 0`, `workHours` is null (nothing to do / cannot estimate).
 */
export function workSpeedProjection(input: WorkSpeedInput): WorkSpeedResult {
  const hectares = Number.isFinite(input.hectares) && input.hectares > 0 ? input.hectares : 0
  const efficiency = clampEfficiency(input.efficiency)

  let totalCapacityHaPerH = 0
  let effectiveCapacityHaPerH = 0

  // First pass: nameplate + effective throughputs (per machine + team totals).
  const partial = input.machines.map((m) => {
    const capacity = capacityHaPerH(m.workingWidthM, m.workingSpeedKmh)
    const effective = capacity * efficiency
    totalCapacityHaPerH += capacity
    effectiveCapacityHaPerH += effective
    return { machine: m, capacity, effective }
  })

  const teamActive = effectiveCapacityHaPerH > 0
  const workHours = teamActive && hectares > 0 ? hectares / effectiveCapacityHaPerH : null

  // Second pass: shares + solo times now that the team rate is known.
  const perMachine: SpeedMachineBreakdown[] = partial.map(({ machine, capacity, effective }) => ({
    id: machine.id,
    name: machine.name,
    workingWidthM: machine.workingWidthM,
    workingSpeedKmh: machine.workingSpeedKmh,
    capacityHaPerH: capacity,
    effectiveCapacityHaPerH: effective,
    soloWorkHours: effective > 0 && hectares > 0 ? hectares / effective : null,
    shareOfTeam: teamActive ? effective / effectiveCapacityHaPerH : 0,
  }))

  // Carry rounding through total minutes so 2.999h renders "3h 00m", not "2h 60m".
  const totalMinutes = workHours === null ? null : Math.round(workHours * 60)

  return {
    hectares,
    efficiency,
    totalCapacityHaPerH,
    effectiveCapacityHaPerH,
    workHours,
    hours: totalMinutes === null ? null : Math.floor(totalMinutes / 60),
    minutes: totalMinutes === null ? null : totalMinutes % 60,
    perMachine,
  }
}

/** Convenience: build the engine input from raw machine records. */
export function toSpeedMachineInputs(
  machines: SpeedMachineInput[],
): SpeedMachineInput[] {
  return machines.map((m) => ({
    id: m.id,
    name: m.name,
    workingWidthM: m.workingWidthM,
    workingSpeedKmh: m.workingSpeedKmh,
  }))
}
