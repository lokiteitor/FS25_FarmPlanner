// tests/engine/workSpeedEngine — internal-consistency tests for the work-time
// (speed) engine (H7.6). Assert the documented relationships, NOT byte-parity
// with the unavailable prototype.

import { describe, expect, it } from 'vitest'
import {
  capacityHaPerH,
  clampEfficiency,
  workSpeedProjection,
  MIN_EFFICIENCY,
  MAX_EFFICIENCY,
} from '~/shared/lib/engine'
import type { SpeedMachineInput } from '~/shared/lib/engine'

// A 6 m / 12 km/h tool ⇒ 6*12/10 = 7.2 ha/h nameplate.
const harvester: SpeedMachineInput = {
  id: 'm-harvester',
  name: 'Cosechadora',
  workingWidthM: 6,
  workingSpeedKmh: 12,
}
// A 3 m / 10 km/h tool ⇒ 3*10/10 = 3 ha/h nameplate.
const cultivator: SpeedMachineInput = {
  id: 'm-cultivator',
  name: 'Cultivador',
  workingWidthM: 3,
  workingSpeedKmh: 10,
}

describe('capacityHaPerH', () => {
  it('is workingWidthM * workingSpeedKmh / 10', () => {
    expect(capacityHaPerH(6, 12)).toBeCloseTo(7.2, 10)
    expect(capacityHaPerH(3, 10)).toBeCloseTo(3, 10)
    expect(capacityHaPerH(1, 10)).toBeCloseTo(1, 10)
  })

  it('returns 0 for non-positive width or speed', () => {
    expect(capacityHaPerH(0, 12)).toBe(0)
    expect(capacityHaPerH(6, 0)).toBe(0)
    expect(capacityHaPerH(-6, 12)).toBe(0)
  })

  it('scales linearly with width and with speed', () => {
    expect(capacityHaPerH(12, 12)).toBeCloseTo(2 * capacityHaPerH(6, 12), 10)
    expect(capacityHaPerH(6, 24)).toBeCloseTo(2 * capacityHaPerH(6, 12), 10)
  })
})

describe('clampEfficiency', () => {
  it('clamps into [0.5, 1]', () => {
    expect(clampEfficiency(0.2)).toBe(MIN_EFFICIENCY)
    expect(clampEfficiency(1.5)).toBe(MAX_EFFICIENCY)
    expect(clampEfficiency(0.8)).toBe(0.8)
  })
  it('falls back to the minimum on non-finite input', () => {
    expect(clampEfficiency(NaN)).toBe(MIN_EFFICIENCY)
    expect(clampEfficiency(Infinity)).toBe(MAX_EFFICIENCY)
  })
})

describe('workSpeedProjection — single machine', () => {
  it('workHours = hectares / (capacity * efficiency)', () => {
    const r = workSpeedProjection({ hectares: 72, efficiency: 1, machines: [harvester] })
    // 72 ha / 7.2 ha/h = 10 h.
    expect(r.effectiveCapacityHaPerH).toBeCloseTo(7.2, 10)
    expect(r.workHours).toBeCloseTo(10, 10)
    expect(r.hours).toBe(10)
    expect(r.minutes).toBe(0)
  })

  it('efficiency stretches the work time inversely', () => {
    const full = workSpeedProjection({ hectares: 72, efficiency: 1, machines: [harvester] })
    const half = workSpeedProjection({ hectares: 72, efficiency: 0.5, machines: [harvester] })
    expect(half.workHours).toBeCloseTo((full.workHours as number) * 2, 10)
  })

  it('splits workHours into whole hours and rounded minutes', () => {
    // 7.2 ha/h at eff 1 over 9 ha = 1.25 h = 1 h 15 min.
    const r = workSpeedProjection({ hectares: 9, efficiency: 1, machines: [harvester] })
    expect(r.workHours).toBeCloseTo(1.25, 10)
    expect(r.hours).toBe(1)
    expect(r.minutes).toBe(15)
  })
})

describe('workSpeedProjection — team (parallel machines)', () => {
  it('adds the post-efficiency throughputs of all machines', () => {
    const r = workSpeedProjection({
      hectares: 102,
      efficiency: 1,
      machines: [harvester, cultivator],
    })
    // 7.2 + 3 = 10.2 ha/h ⇒ 102 / 10.2 = 10 h.
    expect(r.totalCapacityHaPerH).toBeCloseTo(10.2, 10)
    expect(r.effectiveCapacityHaPerH).toBeCloseTo(10.2, 10)
    expect(r.workHours).toBeCloseTo(10, 10)
  })

  it('adding a machine never increases the work time', () => {
    const solo = workSpeedProjection({ hectares: 100, efficiency: 0.9, machines: [harvester] })
    const team = workSpeedProjection({
      hectares: 100,
      efficiency: 0.9,
      machines: [harvester, cultivator],
    })
    expect(team.workHours as number).toBeLessThanOrEqual(solo.workHours as number)
  })

  it('per-machine shares sum to 1 and are proportional to throughput', () => {
    const r = workSpeedProjection({
      hectares: 50,
      efficiency: 0.8,
      machines: [harvester, cultivator],
    })
    const shareSum = r.perMachine.reduce((s, m) => s + m.shareOfTeam, 0)
    expect(shareSum).toBeCloseTo(1, 10)
    // harvester (7.2) vs cultivator (3): ratio of shares matches ratio of caps.
    const [h, c] = r.perMachine
    expect(h!.shareOfTeam / c!.shareOfTeam).toBeCloseTo(7.2 / 3, 10)
  })

  it('per-machine soloWorkHours equals hectares / its effective capacity', () => {
    const r = workSpeedProjection({ hectares: 72, efficiency: 0.5, machines: [harvester] })
    // 7.2 * 0.5 = 3.6 ha/h ⇒ 72 / 3.6 = 20 h solo.
    expect(r.perMachine[0]!.soloWorkHours).toBeCloseTo(20, 10)
  })
})

describe('workSpeedProjection — edge cases', () => {
  it('returns null workHours with no machines', () => {
    const r = workSpeedProjection({ hectares: 50, efficiency: 1, machines: [] })
    expect(r.effectiveCapacityHaPerH).toBe(0)
    expect(r.workHours).toBeNull()
    expect(r.hours).toBeNull()
    expect(r.minutes).toBeNull()
  })

  it('returns null workHours for zero/negative hectares', () => {
    const r = workSpeedProjection({ hectares: 0, efficiency: 1, machines: [harvester] })
    expect(r.workHours).toBeNull()
  })

  it('ignores zero-capacity machines in the team rate but keeps them in the breakdown', () => {
    const dead: SpeedMachineInput = { id: 'd', name: 'Roto', workingWidthM: 0, workingSpeedKmh: 0 }
    const r = workSpeedProjection({ hectares: 72, efficiency: 1, machines: [harvester, dead] })
    expect(r.effectiveCapacityHaPerH).toBeCloseTo(7.2, 10)
    expect(r.workHours).toBeCloseTo(10, 10)
    expect(r.perMachine).toHaveLength(2)
    expect(r.perMachine[1]!.capacityHaPerH).toBe(0)
    expect(r.perMachine[1]!.soloWorkHours).toBeNull()
    expect(r.perMachine[1]!.shareOfTeam).toBe(0)
  })

  it('clamps the efficiency it reports and applies', () => {
    const r = workSpeedProjection({ hectares: 72, efficiency: 2, machines: [harvester] })
    expect(r.efficiency).toBe(MAX_EFFICIENCY)
  })
})
