// tests/features/dataMigration — unit tests for the H8 migration utility.
//
// Two pure surfaces under test:
//   - resolveCropSlug: slug / nameEs (accent-insensitive) / nameEn / fallback,
//     returns null for garbage.
//   - importPrototype: creates farm + fields, maps crop names -> ids, reports an
//     unresolved crop WITHOUT throwing, and CONTINUES past a failing item.
//
// We import the pure lib modules directly (not the slice index, which re-exports
// the .vue panel — vitest has no Vue plugin here). The importer takes injectable
// deps, so we mock the entity api clients as vi.fn() fakes (no network).

import { describe, expect, it, vi } from 'vitest'

import {
  CROP_NAME_FALLBACKS,
  resolveCropSlug,
} from '~/features/data-migration/lib/resolveCropSlug'
import type { ResolverCrop } from '~/features/data-migration/lib/resolveCropSlug'
import { importPrototype } from '~/features/data-migration/lib/importMigration'
import type { ImportDeps } from '~/features/data-migration/lib/importMigration'
import { parsePrototypeExport } from '~/features/data-migration/model/types'
import type { PrototypeExport } from '~/features/data-migration/model/types'

// --- catalog crops fixture (subset of docs/seeds-catalogo.md) ----------------
const CROPS: ResolverCrop[] = [
  { slug: 'corn', nameEs: 'Maíz', nameEn: 'Maize' },
  { slug: 'wheat', nameEs: 'Trigo', nameEn: 'Wheat' },
  { slug: 'barley', nameEs: 'Cebada', nameEn: 'Barley' },
  { slug: 'potato', nameEs: 'Patatas', nameEn: 'Potato' },
  { slug: 'sugarbeet', nameEs: 'Remolacha Azucarera', nameEn: 'Sugar Beet' },
  { slug: 'redbeet', nameEs: 'Remolacha', nameEn: 'Red Beet' },
  { slug: 'poplar', nameEs: 'Álamo (Astillas de Madera)', nameEn: 'Poplar (Wood Chips)' },
]

// Map slug -> a stable fake catalog id for the importer tests.
const CROP_IDS: Record<string, string> = {
  corn: 'id-corn',
  wheat: 'id-wheat',
  barley: 'id-barley',
  potato: 'id-potato',
  sugarbeet: 'id-sugarbeet',
  redbeet: 'id-redbeet',
  poplar: 'id-poplar',
}

describe('resolveCropSlug', () => {
  it('resolves an already-correct slug', () => {
    expect(resolveCropSlug('corn', CROPS)).toBe('corn')
    expect(resolveCropSlug('CORN', CROPS)).toBe('corn')
  })

  it('resolves by Spanish name, accent- and case-insensitive', () => {
    expect(resolveCropSlug('Maíz', CROPS)).toBe('corn')
    expect(resolveCropSlug('maiz', CROPS)).toBe('corn')
    expect(resolveCropSlug('  MAÍZ  ', CROPS)).toBe('corn')
    expect(resolveCropSlug('Álamo (Astillas de Madera)', CROPS)).toBe('poplar')
    expect(resolveCropSlug('alamo (astillas de madera)', CROPS)).toBe('poplar')
  })

  it('resolves by English name', () => {
    expect(resolveCropSlug('Maize', CROPS)).toBe('corn')
    expect(resolveCropSlug('sugar beet', CROPS)).toBe('sugarbeet')
  })

  it('disambiguates "Remolacha" (redbeet) from "Remolacha Azucarera" (sugarbeet)', () => {
    expect(resolveCropSlug('Remolacha', CROPS)).toBe('redbeet')
    expect(resolveCropSlug('Remolacha Azucarera', CROPS)).toBe('sugarbeet')
  })

  it('uses the punctual fallback map for known prototype spellings', () => {
    // "Patata" (singular) is not the catalog nameEs ("Patatas") -> fallback.
    expect(resolveCropSlug('Patata', CROPS)).toBe('potato')
    expect(resolveCropSlug('álamo', CROPS)).toBe('poplar')
    // The fallback map is exported and auditable.
    expect(CROP_NAME_FALLBACKS.patata).toBe('potato')
  })

  it('returns null only when the fallback target is absent from the catalog', () => {
    // 'onion' is in the fallback map but NOT in this fixture catalog.
    expect(resolveCropSlug('Cebolla', CROPS)).toBeNull()
  })

  it('returns null for garbage / empty / nullish input', () => {
    expect(resolveCropSlug('Plutonio', CROPS)).toBeNull()
    expect(resolveCropSlug('', CROPS)).toBeNull()
    expect(resolveCropSlug('   ', CROPS)).toBeNull()
    expect(resolveCropSlug(null, CROPS)).toBeNull()
    expect(resolveCropSlug(undefined, CROPS)).toBeNull()
  })
})

// --- importPrototype ---------------------------------------------------------

/** Build a set of vi.fn() deps standing in for the entity api clients. */
function makeDeps(overrides: Partial<ImportDeps> = {}): {
  deps: ImportDeps
  mocks: { [K in keyof ImportDeps]: ReturnType<typeof vi.fn> }
} {
  const createFarm = vi.fn(async (body: { name: string; gameVersionId?: string }) => ({
    id: 'farm-1',
    userId: 'u-1',
    gameVersionId: body.gameVersionId ?? 'gv-active',
    name: body.name,
    mapName: null,
    difficulty: 'normal',
    defaultYieldBonus: 0,
    sellPriceType: 'baseline',
    notes: null,
  }))
  const loadCrops = vi.fn(async () => CROPS)
  const cropIdBySlug = vi.fn((slug: string) => CROP_IDS[slug])
  const createField = vi.fn(async () => ({ id: 'field-x' }))
  const createStable = vi.fn(async () => ({ id: 'stable-x' }))
  const createMachine = vi.fn(async () => ({ id: 'machine-x' }))
  const upsertAnimalConfig = vi.fn(async () => ({ id: 'cfg-x' }))

  const deps = {
    createFarm,
    loadCrops,
    cropIdBySlug,
    createField,
    createStable,
    createMachine,
    upsertAnimalConfig,
    ...overrides,
  } as unknown as ImportDeps

  return {
    deps,
    mocks: {
      createFarm,
      loadCrops,
      cropIdBySlug,
      createField,
      createStable,
      createMachine,
      upsertAnimalConfig,
      ...overrides,
    } as never,
  }
}

const baseExport: PrototypeExport = {
  version: 1,
  exportedAt: '2026-06-11T00:00:00.000Z',
  settings: { difficulty: 'hard', yieldBonus: 0.425, sellPriceType: 'max_seasonal', mapName: 'Riverbend' },
  fields: [
    { fieldNumber: 1, hectares: 4.2, crop: 'Maíz', isSilage: false },
    { fieldNumber: 2, hectares: 2.0, crop: 'Trigo', isSilage: false },
  ],
}

describe('importPrototype', () => {
  it('creates the farm from prototype settings (difficulty/yieldBonus/sellPrice/map)', async () => {
    const { deps, mocks } = makeDeps()
    const report = await importPrototype(baseExport, { farmName: 'Mi partida' }, deps)

    expect(mocks.createFarm).toHaveBeenCalledTimes(1)
    expect(mocks.createFarm).toHaveBeenCalledWith({
      name: 'Mi partida',
      gameVersionId: undefined,
      mapName: 'Riverbend',
      difficulty: 'hard',
      defaultYieldBonus: 0.425,
      sellPriceType: 'max_seasonal',
    })
    expect(report.farmId).toBe('farm-1')
  })

  it('creates fields and maps crop names to catalog ids', async () => {
    const { deps, mocks } = makeDeps()
    const report = await importPrototype(baseExport, { farmName: 'F' }, deps)

    expect(report.created.fields).toBe(2)
    expect(mocks.createField).toHaveBeenCalledTimes(2)
    expect(mocks.createField).toHaveBeenNthCalledWith(1, 'farm-1', {
      fieldNumber: 1,
      hectares: 4.2,
      cropId: 'id-corn',
      isSilage: false,
      yieldBonus: null,
      purchasePrice: null,
    })
    expect(mocks.createField).toHaveBeenNthCalledWith(2, 'farm-1', expect.objectContaining({
      fieldNumber: 2,
      cropId: 'id-wheat',
    }))
    expect(report.unresolvedCrops).toEqual([])
  })

  it('reports an unresolved crop and creates that field as fallow WITHOUT throwing', async () => {
    const { deps, mocks } = makeDeps()
    const data: PrototypeExport = {
      ...baseExport,
      fields: [
        { fieldNumber: 1, hectares: 1, crop: 'Maíz' },
        { fieldNumber: 2, hectares: 1, crop: 'Plutonio', isSilage: true },
      ],
    }
    const report = await importPrototype(data, { farmName: 'F' }, deps)

    expect(report.unresolvedCrops).toEqual([{ fieldNumber: 2, name: 'Plutonio' }])
    expect(report.created.fields).toBe(2)
    // The unresolved field is created fallow (cropId null) and never silage.
    expect(mocks.createField).toHaveBeenNthCalledWith(2, 'farm-1', expect.objectContaining({
      fieldNumber: 2,
      cropId: null,
      isSilage: false,
    }))
    expect(report.errors).toEqual([])
  })

  it('collects a failing item into report.errors and CONTINUES past it', async () => {
    const createField = vi
      .fn()
      .mockRejectedValueOnce(new Error('DUPLICATE_FIELD_NUMBER'))
      .mockResolvedValue({ id: 'ok' })
    const { deps } = makeDeps({ createField: createField as never })

    const data: PrototypeExport = {
      ...baseExport,
      fields: [
        { fieldNumber: 1, hectares: 1, crop: 'Maíz' },
        { fieldNumber: 2, hectares: 1, crop: 'Trigo' },
      ],
    }
    const report = await importPrototype(data, { farmName: 'F' }, deps)

    expect(createField).toHaveBeenCalledTimes(2) // did not abort after the first throw
    expect(report.created.fields).toBe(1)
    expect(report.errors).toHaveLength(1)
    expect(report.errors[0]).toContain('Campo 1')
    expect(report.errors[0]).toContain('DUPLICATE_FIELD_NUMBER')
  })

  it('creates stables and machinery, skipping an unknown species with a warning', async () => {
    const { deps, mocks } = makeDeps()
    const data: PrototypeExport = {
      ...baseExport,
      stables: [
        { name: 'Establo A', species: 'cow', maxCapacity: 40, currentCount: 10 },
        { name: 'Raro', species: 'dragon', maxCapacity: 1 },
      ],
      machinery: [{ name: 'Cosechadora', workingWidthM: 9, workingSpeedKmh: 10 }],
    }
    const report = await importPrototype(data, { farmName: 'F' }, deps)

    expect(report.created.stables).toBe(1)
    expect(report.created.machinery).toBe(1)
    expect(mocks.createMachine).toHaveBeenCalledWith('farm-1', {
      name: 'Cosechadora',
      workingWidthM: 9,
      workingSpeedKmh: 10,
    })
    expect(report.warnings.some((w) => w.includes('dragon'))).toBe(true)
  })

  it('upserts animal configs, stripping leaked farm-level keys', async () => {
    const { deps, mocks } = makeDeps()
    const data: PrototypeExport = {
      ...baseExport,
      animalConfigs: {
        cow: { count: 30, feedType: 'tmr', difficulty: 'hard', sellPriceType: 'baseline' },
      },
    }
    const report = await importPrototype(data, { farmName: 'F' }, deps)

    expect(report.created.animalConfigs).toBe(1)
    const [, species, inputs] = mocks.upsertAnimalConfig.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ]
    expect(species).toBe('cow')
    expect(inputs).not.toHaveProperty('difficulty')
    expect(inputs).not.toHaveProperty('sellPriceType')
    expect(inputs).toMatchObject({ count: 30, feedType: 'tmr', species: 'cow' })
    expect(report.warnings.some((w) => w.includes('difficulty'))).toBe(true)
  })

  it('applies documented defaults + warnings when settings are absent', async () => {
    const { deps, mocks } = makeDeps()
    const data: PrototypeExport = {
      version: 1,
      exportedAt: '2026-06-11T00:00:00.000Z',
      settings: {},
      fields: [],
    }
    const report = await importPrototype(data, { farmName: 'F' }, deps)

    expect(mocks.createFarm).toHaveBeenCalledWith(
      expect.objectContaining({ difficulty: 'normal', defaultYieldBonus: 0, sellPriceType: 'baseline' }),
    )
    expect(report.warnings.some((w) => w.includes('dificultad'))).toBe(true)
  })
})

// --- zod schema sanity -------------------------------------------------------

describe('parsePrototypeExport (zod)', () => {
  it('parses a minimal/lenient document, coercing number-ish strings', () => {
    const parsed = parsePrototypeExport({
      fields: [{ fieldNumber: '3', hectares: '2.5', crop: 'Maíz', extraKey: 'kept' }],
      extraTopLevel: true,
    })
    expect(parsed.version).toBe(1)
    expect(parsed.fields[0]).toMatchObject({ fieldNumber: 3, hectares: 2.5, crop: 'Maíz' })
    expect(parsed.settings).toEqual({})
  })

  it('throws (ZodError) on a structurally invalid document', () => {
    expect(() => parsePrototypeExport({ fields: [{ hectares: 'not-a-number' }] })).toThrow()
    expect(() => parsePrototypeExport({ settings: { difficulty: 'impossible' } })).toThrow()
  })
})
