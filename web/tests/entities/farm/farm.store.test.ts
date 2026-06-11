// Unit tests for entities/farm/model/farm.store — the Pinia 'farm' store.
//
// Focus: setActiveFarm persists the active-farm pin via PATCH /me/settings
// (farmApi.updateSettings) and adopts the server-returned activeFarmId — the
// store never trusts the requested id blindly, it mirrors what the backend
// stored. We mock the network layer (entities/farm/api/farmApi) entirely;
// vi.mock is hoisted + resolved by module path, so it intercepts the store's
// `import * as farmApi from '../api/farmApi'`.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('~/entities/farm/api/farmApi', () => ({
  list: vi.fn(),
  get1: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}))

import * as farmApi from '~/entities/farm/api/farmApi'
import { useFarmStore } from '~/entities/farm'
import type { Farm, UserSettings } from '~/entities/farm'

const mockApi = vi.mocked(farmApi)

function farm(over: Partial<Farm> = {}): Farm {
  return {
    id: 'f1',
    userId: 'u1',
    gameVersionId: 'gv1',
    name: 'Partida 1',
    mapName: null,
    difficulty: 'normal',
    defaultYieldBonus: 0.425,
    sellPriceType: 'baseline',
    notes: null,
    ...over,
  }
}

function settings(activeFarmId: string | null): UserSettings {
  return {
    userId: 'u1',
    locale: 'es',
    theme: 'system',
    activeFarmId,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('setActiveFarm', () => {
  it('PATCHes /me/settings and adopts the server-returned activeFarmId', async () => {
    mockApi.updateSettings.mockResolvedValue(settings('f2'))
    const store = useFarmStore()
    store.farms = [farm({ id: 'f1' }), farm({ id: 'f2', gameVersionId: 'gv2' })]

    await store.setActiveFarm('f2')

    expect(mockApi.updateSettings).toHaveBeenCalledWith({ activeFarmId: 'f2' })
    expect(store.activeFarmId).toBe('f2')
    // Getters derive from the (now active) farm.
    expect(store.activeFarm?.id).toBe('f2')
    expect(store.activeGameVersionId).toBe('gv2')
    expect(store.saving).toBe(false)
    expect(store.error).toBeNull()
  })

  it('mirrors the server value even if it differs from the requested id', async () => {
    // Backend clamps/normalizes: store must reflect what was persisted.
    mockApi.updateSettings.mockResolvedValue(settings(null))
    const store = useFarmStore()
    store.activeFarmId = 'f1'

    await store.setActiveFarm('f9')

    expect(mockApi.updateSettings).toHaveBeenCalledWith({ activeFarmId: 'f9' })
    expect(store.activeFarmId).toBeNull()
    expect(store.activeFarm).toBeNull()
    expect(store.activeGameVersionId).toBeNull()
  })

  it('records the error message and rethrows when the PATCH fails', async () => {
    mockApi.updateSettings.mockRejectedValue(new Error('network down'))
    const store = useFarmStore()
    store.activeFarmId = 'f1'

    await expect(store.setActiveFarm('f2')).rejects.toThrow('network down')

    expect(store.error).toBe('network down')
    expect(store.saving).toBe(false)
    // The local pin is left untouched on failure.
    expect(store.activeFarmId).toBe('f1')
  })
})
