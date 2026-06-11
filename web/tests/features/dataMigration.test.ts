// tests/features/dataMigration — unit tests for the H8 migration utility,
// matching the REAL prototype IndexedDB schema (planner/app/composables/useDB.ts
// + the pages that persist data):
//
//   DB name 'fs25_farm_planner_db'; store 'fields' rows carry the Spanish crop in
//   `selectedCrop`; store 'settings' is a plain KV store with keys 'app_settings'
//   ({difficulty:'Easy'|…, yieldBonus}), 'global_settings' ({sellPrice:'Baseline'|
//   'MaxSeasonal'}), 'registered_machinery' ({name,width,speed}[]),
//   'registered_stables' ({name,type:'Cow'|…,maxCapacity,currentCount,settings}[]),
//   and 'animal_<species>' raw calculator inputs (numCows/feedType 'TMR'/…).
//
// Surfaces under test:
//   - resolveCropSlug: slug / nameEs (accent-insensitive) / nameEn / fallback.
//   - translateAnimalConfig: prototype inputs → API encoding (count from
//     numCows/numChx/…, feedType 'TMR'→'tmr', crop names PascalCase→slug).
//   - importPrototype: farm + fields + stables + machinery + animal configs,
//     reporting unresolved crops and continuing past failures.
//   - exportFromIndexedDb: reads a seeded fake-indexeddb DB of the real schema.
//
// We import the pure lib modules directly (not the slice index, which re-exports
// .vue panels — vitest has no Vue plugin). The importer takes injectable deps, so
// we mock the entity api clients as vi.fn() fakes (no network).

import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CROP_NAME_FALLBACKS,
  resolveCropSlug,
} from '~/features/data-migration/lib/resolveCropSlug'
import type { ResolverCrop } from '~/features/data-migration/lib/resolveCropSlug'
import { translateAnimalConfig } from '~/features/data-migration/lib/translateAnimalConfig'
import { importPrototype } from '~/features/data-migration/lib/importMigration'
import type { ImportDeps } from '~/features/data-migration/lib/importMigration'
import {
  DEFAULT_PROTOTYPE_DB_NAME,
  exportFromIndexedDb,
} from '~/features/data-migration/lib/exportIndexedDb'
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

// --- translateAnimalConfig (prototype inputs -> API encoding) -----------------

describe('translateAnimalConfig', () => {
  it('maps cow inputs: numCows->count, feedType TMR->tmr, silageCrop Corn->corn', () => {
    // The raw prototype `animal_cows` bag (with leaked difficulty/sellPriceType).
    const out = translateAnimalConfig('cow', {
      selectedStableName: 'Establo Vacas',
      numCows: 45,
      yieldBonus: 0.425,
      grassHarvests: 2,
      provideStraw: true,
      breed: 'Holstein',
      feedType: 'TMR',
      difficulty: 'Easy',
      sellPriceType: 'MaxSeasonal',
      sellCount: 5,
      silageCrop: 'Corn',
    })
    expect(out).toMatchObject({
      species: 'cow',
      count: 45,
      yieldBonus: 0.425,
      grassHarvests: 2,
      provideStraw: true,
      breed: 'Holstein',
      feedType: 'tmr',
      sellCount: 5,
      silageCrop: 'corn',
    })
    // Farm-level + stable-link + count-alias keys are stripped.
    expect(out).not.toHaveProperty('difficulty')
    expect(out).not.toHaveProperty('sellPriceType')
    expect(out).not.toHaveProperty('selectedStableName')
    expect(out).not.toHaveProperty('numCows')
  })

  it('maps a non-Holstein cow breed to "Other"', () => {
    expect(translateAnimalConfig('cow', { numCows: 1, breed: 'Jersey' })).toMatchObject({
      breed: 'Other',
    })
  })

  it('maps buffalo (numBuffaloes->count) and drops percentProductive', () => {
    const out = translateAnimalConfig('buffalo', {
      numBuffaloes: 45,
      feedType: 'Hay',
      percentProductive: 100,
      silageCrop: 'Barley',
    })
    expect(out).toMatchObject({ species: 'buffalo', count: 45, feedType: 'hay', silageCrop: 'barley' })
    expect(out).not.toHaveProperty('percentProductive')
  })

  it('maps chicken: numChx->count, feedBoughtPercent->boughtFeedPercent, feedType->boughtFeedType, fieldworkCrop->grownCrop', () => {
    const out = translateAnimalConfig('chicken', {
      numChx: 96,
      feedBoughtPercent: 50,
      feedType: 'Oat',
      fieldworkCrop: 'Wheat',
    })
    expect(out).toMatchObject({
      species: 'chicken',
      count: 96,
      boughtFeedPercent: 50,
      boughtFeedType: 'oat',
      grownCrop: 'wheat',
    })
    expect(out).not.toHaveProperty('feedBoughtPercent')
    expect(out).not.toHaveProperty('fieldworkCrop')
  })

  it('maps sheep/goat (numSheep/numGoats -> count, grassHarvests kept)', () => {
    expect(translateAnimalConfig('sheep', { numSheep: 50, grassHarvests: 2 })).toMatchObject({
      species: 'sheep',
      count: 50,
      grassHarvests: 2,
    })
    expect(translateAnimalConfig('goat', { numGoats: 30, grassHarvests: 2 })).toMatchObject({
      species: 'goat',
      count: 30,
      grassHarvests: 2,
    })
  })

  it('maps pig feed crops: Corn/Wheat/Soy/Potato -> slugs (Soy->soybean)', () => {
    const out = translateAnimalConfig('pig', {
      numPigs: 80,
      provideStraw: true,
      sellCount: 10,
      baseCrop: 'Corn',
      grainCrop: 'Wheat',
      proteinCrop: 'Soy',
      rootCrop: 'Potato',
    })
    expect(out).toMatchObject({
      species: 'pig',
      count: 80,
      provideStraw: true,
      sellCount: 10,
      baseCrop: 'corn',
      grainCrop: 'wheat',
      proteinCrop: 'soybean',
      rootCrop: 'potato',
    })
  })

  it('maps horse feed crops: Oat/Potato -> slugs', () => {
    const out = translateAnimalConfig('horse', {
      numHorses: 10,
      provideStraw: false,
      grassHarvests: 2,
      sellCount: 4,
      baseCrop: 'Oat',
      rootCrop: 'Potato',
    })
    expect(out).toMatchObject({
      species: 'horse',
      count: 10,
      provideStraw: false,
      baseCrop: 'oat',
      rootCrop: 'potato',
    })
  })

  it('falls back to a generic `count` and omits absent optionals', () => {
    const out = translateAnimalConfig('cow', { count: 12 })
    expect(out).toEqual({ species: 'cow', count: 12 })
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

  it('creates stables (PascalCase type -> species) and machinery, translating config, skipping unknown species', async () => {
    const { deps, mocks } = makeDeps()
    const data: PrototypeExport = {
      ...baseExport,
      stables: [
        // Real prototype stable: `type` PascalCase + a raw `settings`/config bag.
        {
          name: 'Establo A',
          species: 'Cow',
          maxCapacity: 40,
          currentCount: 10,
          config: {
            numCows: 10,
            feedType: 'TMR',
            silageCrop: 'Corn',
            difficulty: 'Easy',
            sellPriceType: 'MaxSeasonal',
          },
        },
        { name: 'Raro', species: 'Dragon', maxCapacity: 1 },
      ],
      machinery: [{ name: 'Cosechadora', workingWidthM: 9, workingSpeedKmh: 10 }],
    }
    const report = await importPrototype(data, { farmName: 'F' }, deps)

    expect(report.created.stables).toBe(1)
    expect(report.created.machinery).toBe(1)
    // species normalized to lowercase; config translated + count/species/leaked dropped.
    expect(mocks.createStable).toHaveBeenCalledWith('farm-1', {
      name: 'Establo A',
      species: 'cow',
      maxCapacity: 40,
      currentCount: 10,
      config: { feedType: 'tmr', silageCrop: 'corn' },
    })
    expect(mocks.createMachine).toHaveBeenCalledWith('farm-1', {
      name: 'Cosechadora',
      workingWidthM: 9,
      workingSpeedKmh: 10,
    })
    expect(report.warnings.some((w) => w.includes('Dragon'))).toBe(true)
  })

  it('translates + upserts animal configs from the prototype inputs, dropping leaked keys', async () => {
    const { deps, mocks } = makeDeps()
    const data: PrototypeExport = {
      ...baseExport,
      animalConfigs: {
        // Raw `animal_cows` bag straight from the prototype.
        cow: {
          numCows: 30,
          feedType: 'TMR',
          silageCrop: 'Corn',
          difficulty: 'hard',
          sellPriceType: 'baseline',
        },
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
    expect(inputs).not.toHaveProperty('numCows')
    expect(inputs).toMatchObject({ count: 30, feedType: 'tmr', silageCrop: 'corn', species: 'cow' })
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

// --- exportFromIndexedDb (real prototype schema, fake-indexeddb) --------------

/** Seed a fake-indexeddb DB matching the real prototype schema, then resolve. */
function seedPrototypeDb(
  dbName: string,
  fields: Record<string, unknown>[],
  settings: Record<string, unknown>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      // Mirror useDB.ts: fields keyPath 'id' autoIncrement; settings plain KV.
      if (!db.objectStoreNames.contains('fields')) {
        db.createObjectStore('fields', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings')
      }
    }
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction(['fields', 'settings'], 'readwrite')
      const fieldStore = tx.objectStore('fields')
      for (const f of fields) fieldStore.add(f)
      const settingStore = tx.objectStore('settings')
      for (const [key, value] of Object.entries(settings)) settingStore.put(value, key)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    }
  })
}

describe('exportFromIndexedDb (real prototype schema)', () => {
  const DB = 'fs25_farm_planner_db_test'

  const dropDb = () =>
    new Promise<void>((resolve) => {
      const r = indexedDB.deleteDatabase(DB)
      r.onsuccess = () => resolve()
      r.onerror = () => resolve()
      r.onblocked = () => resolve()
    })

  beforeEach(dropDb)
  afterEach(dropDb)

  it('uses the REAL prototype DB name as the default', () => {
    expect(DEFAULT_PROTOTYPE_DB_NAME).toBe('fs25_farm_planner_db')
  })

  it('maps fields (selectedCrop), settings (app_settings/global_settings), machinery, stables and animal configs', async () => {
    await seedPrototypeDb(
      DB,
      [
        { fieldNumber: 1, hectares: 12.5, selectedCrop: 'Maíz', yieldBonus: 0.425, purchasePrice: 100000 },
        { fieldNumber: 2, hectares: 5, selectedCrop: '', yieldBonus: 0.1, purchasePrice: 0 },
      ],
      {
        app_settings: { difficulty: 'Easy', yieldBonus: 0.425 },
        global_settings: { sellPrice: 'MaxSeasonal' },
        registered_machinery: [{ name: 'Sembradora', width: 9, speed: 15 }],
        registered_stables: [
          { name: 'Establo Vacas', type: 'Cow', maxCapacity: 80, currentCount: 45, settings: { numCows: 45 } },
        ],
        animal_cows: { numCows: 45, feedType: 'TMR', silageCrop: 'Corn', difficulty: 'Easy' },
        animal_chickens: { numChx: 96, feedType: 'Oat' },
        work_speed_calculator_data: { hectares: 20, efficiency: 90 },
      },
    )

    const out = await exportFromIndexedDb(DB)

    // Settings: app_settings difficulty/yieldBonus + global_settings sellPrice,
    // all translated to the API encoding.
    expect(out.settings.difficulty).toBe('easy')
    expect(out.settings.yieldBonus).toBe(0.425)
    expect(out.settings.sellPriceType).toBe('max_seasonal')

    // Fields: selectedCrop -> crop; '' -> null (fallow).
    expect(out.fields).toHaveLength(2)
    expect(out.fields[0]).toMatchObject({
      fieldNumber: 1,
      hectares: 12.5,
      crop: 'Maíz',
      isSilage: false,
      yieldBonus: 0.425,
      purchasePrice: 100000,
    })
    expect(out.fields[1]?.crop).toBeNull()

    // Machinery: width/speed -> workingWidthM/workingSpeedKmh.
    expect(out.machinery).toEqual([
      { name: 'Sembradora', workingWidthM: 9, workingSpeedKmh: 15 },
    ])

    // Stables: prototype `type` carried as raw species; `settings` -> config.
    expect(out.stables).toEqual([
      { name: 'Establo Vacas', species: 'Cow', maxCapacity: 80, currentCount: 45, config: { numCows: 45 } },
    ])

    // Animal configs: raw prototype bags, keyed by API species.
    expect(out.animalConfigs?.cow).toMatchObject({ numCows: 45, feedType: 'TMR', silageCrop: 'Corn' })
    expect(out.animalConfigs?.chicken).toMatchObject({ numChx: 96, feedType: 'Oat' })
  })

  it('produces an export that imports cleanly end-to-end (DB -> export -> import)', async () => {
    await seedPrototypeDb(
      DB,
      [{ fieldNumber: 1, hectares: 10, selectedCrop: 'Trigo', yieldBonus: 0.2, purchasePrice: 50000 }],
      {
        app_settings: { difficulty: 'Hard', yieldBonus: 0.3 },
        global_settings: { sellPrice: 'Baseline' },
        animal_cows: { numCows: 20, feedType: 'TMR', difficulty: 'Hard', sellPriceType: 'Baseline' },
      },
    )

    const exported = await exportFromIndexedDb(DB)
    const { deps, mocks } = makeDeps()
    const report = await importPrototype(exported, { farmName: 'From DB' }, deps)

    expect(report.errors).toEqual([])
    expect(report.created.fields).toBe(1)
    expect(report.created.animalConfigs).toBe(1)
    expect(mocks.createFarm).toHaveBeenCalledWith(
      expect.objectContaining({ difficulty: 'hard', defaultYieldBonus: 0.3, sellPriceType: 'baseline' }),
    )
    expect(mocks.createField).toHaveBeenCalledWith('farm-1', expect.objectContaining({ cropId: 'id-wheat' }))
    const cowInputs = mocks.upsertAnimalConfig.mock.calls[0]?.[2] as Record<string, unknown>
    expect(cowInputs).toMatchObject({ species: 'cow', count: 20, feedType: 'tmr' })
    expect(cowInputs).not.toHaveProperty('difficulty')
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
