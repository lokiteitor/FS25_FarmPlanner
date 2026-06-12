import { describe, it, expect } from 'vitest'
import {
  activeChains,
  effectiveCyclesPerMonth,
  quantityPerMonth,
  chainProjection,
  productionProjection,
} from '~/shared/lib/engine'
import type { EngineProductionBuilding, EngineProductionChain } from '~/shared/lib/engine'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const WHEAT_FLOUR_CHAIN: EngineProductionChain = {
  id: 'chain-wheat-flour',
  name: 'Harina de Trigo',
  isActive: true,
  cyclesPerMonth: 2520,
  inputs: [{ slug: 'wheat', label: 'Trigo', quantityPerCycle: 5 }],
  outputs: [{ slug: 'flour', label: 'Harina', quantityPerCycle: 4 }],
}

const BARLEY_FLOUR_CHAIN: EngineProductionChain = {
  id: 'chain-barley-flour',
  name: 'Harina de Cebada',
  isActive: true,
  cyclesPerMonth: 480,
  inputs: [{ slug: 'barley', label: 'Cebada', quantityPerCycle: 30 }],
  outputs: [{ slug: 'flour', label: 'Harina', quantityPerCycle: 22 }],
}

const INACTIVE_CHAIN: EngineProductionChain = {
  id: 'chain-oat-flour',
  name: 'Harina de Avena',
  isActive: false,
  cyclesPerMonth: 1200,
  inputs: [{ slug: 'oat', label: 'Avena', quantityPerCycle: 15 }],
  outputs: [{ slug: 'flour', label: 'Harina', quantityPerCycle: 15 }],
}

function makeMill(chains: EngineProductionChain[]): EngineProductionBuilding {
  return {
    id: 'building-mill-1',
    name: 'Mi Molino',
    buildingTypeSlug: 'mill',
    chains,
  }
}

// ---------------------------------------------------------------------------
// effectiveCyclesPerMonth
// ---------------------------------------------------------------------------

describe('effectiveCyclesPerMonth — splits cycles by active chain count', () => {
  it('returns full cycles when only 1 chain is active', () => {
    expect(effectiveCyclesPerMonth(2520, 1)).toBe(2520)
  })

  it('halves cycles when 2 chains are active', () => {
    expect(effectiveCyclesPerMonth(2520, 2)).toBe(1260)
  })

  it('divides by N when N chains are active', () => {
    expect(effectiveCyclesPerMonth(480, 4)).toBe(120)
  })

  it('returns 0 when there are no active chains', () => {
    expect(effectiveCyclesPerMonth(1200, 0)).toBe(0)
  })

  it('handles fractional cycle counts (sawmill_walls: 33.6 cycles)', () => {
    expect(effectiveCyclesPerMonth(33.6, 2)).toBeCloseTo(16.8, 6)
  })
})

// ---------------------------------------------------------------------------
// quantityPerMonth
// ---------------------------------------------------------------------------

describe('quantityPerMonth — cycle × quantity', () => {
  it('multiplies qty per cycle by effective cycles', () => {
    const io = { slug: 'wheat', quantityPerCycle: 5 }
    expect(quantityPerMonth(io, 2520)).toBe(12600)
  })

  it('returns 0 when effective cycles is 0 (inactive chain)', () => {
    const io = { slug: 'flour', quantityPerCycle: 4 }
    expect(quantityPerMonth(io, 0)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// activeChains
// ---------------------------------------------------------------------------

describe('activeChains — filters only isActive=true', () => {
  it('returns both active chains in a two-chain building', () => {
    const building = makeMill([WHEAT_FLOUR_CHAIN, BARLEY_FLOUR_CHAIN])
    expect(activeChains(building)).toHaveLength(2)
  })

  it('excludes inactive chains', () => {
    const building = makeMill([WHEAT_FLOUR_CHAIN, INACTIVE_CHAIN])
    const result = activeChains(building)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('chain-wheat-flour')
  })

  it('returns empty when all chains are inactive', () => {
    const building = makeMill([INACTIVE_CHAIN])
    expect(activeChains(building)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// chainProjection — single chain result
// ---------------------------------------------------------------------------

describe('chainProjection — wheat flour chain alone at full capacity', () => {
  it('uses full cycles when 1 active chain', () => {
    const result = chainProjection(WHEAT_FLOUR_CHAIN, 1)
    expect(result.effectiveCyclesPerMonth).toBe(2520)
    expect(result.isActive).toBe(true)
    expect(result.inputsPerMonth[0].quantityPerMonth).toBe(5 * 2520) // 12600 wheat
    expect(result.outputsPerMonth[0].quantityPerMonth).toBe(4 * 2520) // 10080 flour
  })

  it('halves production when split across 2 active chains', () => {
    const result = chainProjection(WHEAT_FLOUR_CHAIN, 2)
    expect(result.effectiveCyclesPerMonth).toBe(1260)
    expect(result.inputsPerMonth[0].quantityPerMonth).toBe(5 * 1260) // 6300 wheat
    expect(result.outputsPerMonth[0].quantityPerMonth).toBe(4 * 1260) // 5040 flour
  })

  it('inactive chain produces nothing regardless of activeCount', () => {
    const result = chainProjection(INACTIVE_CHAIN, 1)
    expect(result.effectiveCyclesPerMonth).toBe(0)
    expect(result.inputsPerMonth[0].quantityPerMonth).toBe(0)
    expect(result.outputsPerMonth[0].quantityPerMonth).toBe(0)
  })

  it('preserves slug and label in IO lines', () => {
    const result = chainProjection(WHEAT_FLOUR_CHAIN, 1)
    expect(result.inputsPerMonth[0].slug).toBe('wheat')
    expect(result.inputsPerMonth[0].label).toBe('Trigo')
    expect(result.outputsPerMonth[0].slug).toBe('flour')
    expect(result.outputsPerMonth[0].label).toBe('Harina')
  })
})

// ---------------------------------------------------------------------------
// productionProjection — building-level totals
// ---------------------------------------------------------------------------

describe('productionProjection — single active chain (wheat flour)', () => {
  it('returns activeChainCount = 1 and full cycles', () => {
    const result = productionProjection(makeMill([WHEAT_FLOUR_CHAIN]))
    expect(result.activeChainCount).toBe(1)
    expect(result.chains[0].effectiveCyclesPerMonth).toBe(2520)
  })

  it('total inputs and outputs equal the single chain values', () => {
    const result = productionProjection(makeMill([WHEAT_FLOUR_CHAIN]))
    expect(result.totalInputsPerMonth).toHaveLength(1)
    expect(result.totalInputsPerMonth[0].slug).toBe('wheat')
    expect(result.totalInputsPerMonth[0].quantityPerMonth).toBe(12600)
    expect(result.totalOutputsPerMonth[0].slug).toBe('flour')
    expect(result.totalOutputsPerMonth[0].quantityPerMonth).toBe(10080)
  })
})

describe('productionProjection — two active chains split cycles', () => {
  it('activeChainCount is 2', () => {
    const result = productionProjection(
      makeMill([WHEAT_FLOUR_CHAIN, BARLEY_FLOUR_CHAIN]),
    )
    expect(result.activeChainCount).toBe(2)
  })

  it('each chain runs at half its base cycles', () => {
    const result = productionProjection(
      makeMill([WHEAT_FLOUR_CHAIN, BARLEY_FLOUR_CHAIN]),
    )
    const wheat = result.chains.find((c) => c.chainId === 'chain-wheat-flour')!
    const barley = result.chains.find(
      (c) => c.chainId === 'chain-barley-flour',
    )!
    expect(wheat.effectiveCyclesPerMonth).toBe(1260) // 2520 / 2
    expect(barley.effectiveCyclesPerMonth).toBe(240) // 480 / 2
  })

  it('total flour output sums both chains', () => {
    const result = productionProjection(
      makeMill([WHEAT_FLOUR_CHAIN, BARLEY_FLOUR_CHAIN]),
    )
    // wheat: 4 * 1260 = 5040; barley: 22 * 240 = 5280; total = 10320
    const flourTotal = result.totalOutputsPerMonth.find(
      (o) => o.slug === 'flour',
    )!
    expect(flourTotal.quantityPerMonth).toBe(4 * 1260 + 22 * 240) // 10320
  })

  it('total inputs list both slugs (wheat and barley)', () => {
    const result = productionProjection(
      makeMill([WHEAT_FLOUR_CHAIN, BARLEY_FLOUR_CHAIN]),
    )
    const slugs = result.totalInputsPerMonth.map((i) => i.slug)
    expect(slugs).toContain('barley')
    expect(slugs).toContain('wheat')
  })
})

describe('productionProjection — inactive chain does not affect active split', () => {
  it('activeChainCount excludes inactive chains', () => {
    const result = productionProjection(
      makeMill([WHEAT_FLOUR_CHAIN, INACTIVE_CHAIN]),
    )
    expect(result.activeChainCount).toBe(1)
  })

  it('active chain runs at full capacity (not split with inactive)', () => {
    const result = productionProjection(
      makeMill([WHEAT_FLOUR_CHAIN, INACTIVE_CHAIN]),
    )
    const wheat = result.chains.find((c) => c.chainId === 'chain-wheat-flour')!
    expect(wheat.effectiveCyclesPerMonth).toBe(2520) // not halved
  })

  it('inactive chain produces 0 output', () => {
    const result = productionProjection(
      makeMill([WHEAT_FLOUR_CHAIN, INACTIVE_CHAIN]),
    )
    const oat = result.chains.find((c) => c.chainId === 'chain-oat-flour')!
    expect(oat.inputsPerMonth[0].quantityPerMonth).toBe(0)
    expect(oat.outputsPerMonth[0].quantityPerMonth).toBe(0)
  })

  it('total outputs contain only flour from the active chain', () => {
    const result = productionProjection(
      makeMill([WHEAT_FLOUR_CHAIN, INACTIVE_CHAIN]),
    )
    const flourTotal = result.totalOutputsPerMonth.find(
      (o) => o.slug === 'flour',
    )!
    expect(flourTotal.quantityPerMonth).toBe(10080) // 4 * 2520
  })
})

describe('productionProjection — building with all inactive chains', () => {
  it('activeChainCount is 0', () => {
    const result = productionProjection(makeMill([INACTIVE_CHAIN]))
    expect(result.activeChainCount).toBe(0)
  })

  it('all totals are 0', () => {
    const result = productionProjection(makeMill([INACTIVE_CHAIN]))
    // flour appears in totalOutputsPerMonth with qty 0
    for (const line of result.totalOutputsPerMonth) {
      expect(line.quantityPerMonth).toBe(0)
    }
  })
})

describe('productionProjection — echoes building metadata', () => {
  it('buildingId, buildingName, buildingTypeSlug are echoed', () => {
    const building = makeMill([WHEAT_FLOUR_CHAIN])
    const result = productionProjection(building)
    expect(result.buildingId).toBe('building-mill-1')
    expect(result.buildingName).toBe('Mi Molino')
    expect(result.buildingTypeSlug).toBe('mill')
  })
})

describe('productionProjection — sawmill fractional cycles (33.6/month)', () => {
  const PLANKS_CHAIN: EngineProductionChain = {
    id: 'chain-planks',
    name: 'Tablas',
    isActive: true,
    cyclesPerMonth: 24,
    inputs: [{ slug: 'wood', quantityPerCycle: 416 }],
    outputs: [{ slug: 'planks', quantityPerCycle: 410 }],
  }
  const WALLS_CHAIN: EngineProductionChain = {
    id: 'chain-walls',
    name: 'Muros Prefabricados',
    isActive: true,
    cyclesPerMonth: 33.6,
    inputs: [{ slug: 'wood', quantityPerCycle: 412 }],
    outputs: [{ slug: 'walls', quantityPerCycle: 100 }],
  }
  const sawmill: EngineProductionBuilding = {
    id: 'building-sawmill',
    name: 'Mi Aserradero',
    buildingTypeSlug: 'sawmill',
    chains: [PLANKS_CHAIN, WALLS_CHAIN],
  }

  it('each chain gets half its base cycles (float result)', () => {
    const result = productionProjection(sawmill)
    const planks = result.chains.find((c) => c.chainId === 'chain-planks')!
    const walls = result.chains.find((c) => c.chainId === 'chain-walls')!
    expect(planks.effectiveCyclesPerMonth).toBeCloseTo(12, 6)
    expect(walls.effectiveCyclesPerMonth).toBeCloseTo(16.8, 6)
  })

  it('wood is aggregated across both chains in total inputs', () => {
    const result = productionProjection(sawmill)
    const wood = result.totalInputsPerMonth.find((i) => i.slug === 'wood')!
    // planks: 416 * 12 = 4992; walls: 412 * 16.8 = 6921.6
    expect(wood.quantityPerMonth).toBeCloseTo(416 * 12 + 412 * 16.8, 4)
  })
})
