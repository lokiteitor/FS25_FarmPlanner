// features/data-migration/lib/translateAnimalConfig — translate the PROTOTYPE's
// raw per-species calculator inputs (as stored under the `animal_<species>`
// IndexedDB settings keys, or inside a prototype stable's `settings` bag) into
// the API's `AnimalConfigInputs` encoding.
//
// The prototype input shapes (verified against planner/app/pages/animals/*.vue):
//
//   cow:      { selectedStableName, numCows, yieldBonus, grassHarvests,
//               provideStraw, breed:'Holstein'|…, feedType:'TMR'|'Simple'|'Hay'|
//               'Grass', difficulty, sellPriceType, sellCount, silageCrop:'Corn'|… }
//   buffalo:  { selectedStableName, numBuffaloes, …, feedType:'TMR'|'Hay'|'Grass',
//               percentProductive, silageCrop, … }   (NO breed, NO 'Simple')
//   chicken:  { selectedStableName, numChx, yieldBonus, difficulty, sellPriceType,
//               feedBoughtPercent, feedType:'Wheat'|'Oat', fieldworkCrop:'Wheat'|… }
//   sheep:    { selectedSheepStableName, numSheep, yieldBonus, grassHarvests, … }
//   goat:     { selectedGoatsStableName, numGoats, yieldBonus, grassHarvests, … }
//   pig:      { selectedStableName, numPigs, …, sellCount, provideStraw,
//               baseCrop:'Corn'|'Sorghum', grainCrop:'Wheat'|'Barley',
//               proteinCrop:'Soy'|'Canola'|'Sunflower', rootCrop:'Potato'|… }
//   horse:    { selectedStableName, numHorses, …, grassHarvests, sellCount,
//               provideStraw, baseCrop:'Oat'|'Sorghum', rootCrop:'Potato'|… }
//
// API target (features/calculator-config/model/types — mirrors openapi):
//   count, yieldBonus?, feedType:'tmr'|'simple'|'hay'|'grass', provideStraw?,
//   grassHarvests?, silageCrop? (slug), sellCount?, breed:'Holstein'|'Other',
//   boughtFeedPercent?, boughtFeedType:'oat'|'wheat', grownCrop? (slug),
//   baseCrop/grainCrop/proteinCrop/rootCrop (slugs), species discriminant.
//
// Difficulty / sellPriceType live on the FARM, not on a config — they are
// STRIPPED here (the prototype leaked them into the per-species inputs). The
// stable link (selectedStableName/…) is dropped too (no slug→id mapping at
// import time). Crop encodings are reversed via the maps below; these mirror the
// contract→proto map in tests/parity/generateGolden.ts (now applied in reverse).

import type { AnimalSpecies } from '~/entities/catalog'

/** Per-species prototype head-count field name → API `count`. */
const COUNT_KEY_BY_SPECIES: Readonly<Record<AnimalSpecies, string>> = {
  cow: 'numCows',
  buffalo: 'numBuffaloes',
  chicken: 'numChx',
  sheep: 'numSheep',
  goat: 'numGoats',
  pig: 'numPigs',
  horse: 'numHorses',
}

/** Prototype feedType (PascalCase) → API feedType. */
const FEED_TYPE: Readonly<Record<string, string>> = {
  TMR: 'tmr',
  Simple: 'simple',
  Hay: 'hay',
  Grass: 'grass',
}

/** Prototype silage / fieldwork / feed crop names (PascalCase) → catalog slug. */
const CROP_NAME_TO_SLUG: Readonly<Record<string, string>> = {
  Corn: 'corn',
  Barley: 'barley',
  Wheat: 'wheat',
  Sorghum: 'sorghum',
  Sunflower: 'sunflower',
  Oat: 'oat',
  Canola: 'canola',
  Soybean: 'soybean',
  // Pig protein crop shorthand.
  Soy: 'soybean',
  // Root crops (pig/horse).
  Potato: 'potato',
  Sugarbeet: 'sugarbeet',
  Redbeet: 'redbeet',
  Parsnip: 'parsnip',
  Carrot: 'carrot',
}

/** Prototype chicken bought-feed (PascalCase) → API boughtFeedType. */
const BOUGHT_FEED: Readonly<Record<string, string>> = {
  Oat: 'oat',
  Wheat: 'wheat',
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function toBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1) return true
  if (value === 'false' || value === 0) return false
  return undefined
}

/**
 * Translate a feed/silage/fieldwork crop value. Accepts the prototype PascalCase
 * names ('Corn') and pass-through slugs ('corn') and lowercased variants.
 * Returns `undefined` when the input is empty/unknown so the caller can omit it.
 */
function toCropSlug(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const raw = value.trim()
  if (CROP_NAME_TO_SLUG[raw]) return CROP_NAME_TO_SLUG[raw]
  const lower = raw.toLowerCase()
  // If it is already a known slug (a re-import), keep it.
  if (Object.values(CROP_NAME_TO_SLUG).includes(lower)) return lower
  return lower
}

/** Translate prototype feedType → API feedType (undefined if absent/unknown). */
function toFeedType(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const raw = value.trim()
  if (FEED_TYPE[raw]) return FEED_TYPE[raw]
  const lower = raw.toLowerCase()
  if (['tmr', 'simple', 'hay', 'grass'].includes(lower)) return lower
  return undefined
}

/** Conditionally set a key on `out` only when `value` is defined. */
function set<T>(out: Record<string, unknown>, key: string, value: T | undefined): void {
  if (value !== undefined) out[key] = value
}

/**
 * Translate one species' raw prototype inputs into the API `AnimalConfigInputs`
 * shape. `species` is the API species (lowercase) and is set as the discriminant.
 * Unknown/empty optional fields are omitted. Difficulty / sellPriceType / stable
 * links / per-species count aliases are intentionally dropped/renamed.
 */
export function translateAnimalConfig(
  species: AnimalSpecies,
  rawInputs: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const r = asRecord(rawInputs)
  const out: Record<string, unknown> = { species }

  // Head count: per-species prototype key, with a generic `count` fallback.
  const count = toNumber(r[COUNT_KEY_BY_SPECIES[species]]) ?? toNumber(r.count)
  if (count !== undefined) out.count = count

  // Shared optional yieldBonus (the API also accepts a per-config override).
  set(out, 'yieldBonus', toNumber(r.yieldBonus))

  switch (species) {
    case 'cow': {
      set(out, 'feedType', toFeedType(r.feedType))
      set(out, 'provideStraw', toBool(r.provideStraw))
      set(out, 'grassHarvests', toNumber(r.grassHarvests))
      set(out, 'silageCrop', toCropSlug(r.silageCrop))
      set(out, 'sellCount', toNumber(r.sellCount))
      // breed: 'Holstein' stays; anything else → 'Other'.
      if (typeof r.breed === 'string' && r.breed.trim() !== '') {
        out.breed = r.breed === 'Holstein' ? 'Holstein' : 'Other'
      }
      break
    }
    case 'buffalo': {
      set(out, 'feedType', toFeedType(r.feedType))
      set(out, 'provideStraw', toBool(r.provideStraw))
      set(out, 'grassHarvests', toNumber(r.grassHarvests))
      set(out, 'silageCrop', toCropSlug(r.silageCrop))
      set(out, 'sellCount', toNumber(r.sellCount))
      // percentProductive is NOT part of the API contract → dropped.
      break
    }
    case 'chicken': {
      // feedBoughtPercent → boughtFeedPercent; feedType → boughtFeedType;
      // fieldworkCrop → grownCrop.
      set(out, 'boughtFeedPercent', toNumber(r.feedBoughtPercent) ?? toNumber(r.boughtFeedPercent))
      const boughtRaw = r.feedType ?? r.boughtFeedType
      if (typeof boughtRaw === 'string' && boughtRaw.trim() !== '') {
        out.boughtFeedType = BOUGHT_FEED[boughtRaw.trim()] ?? boughtRaw.trim().toLowerCase()
      }
      set(out, 'grownCrop', toCropSlug(r.fieldworkCrop ?? r.grownCrop))
      break
    }
    case 'sheep':
    case 'goat': {
      set(out, 'grassHarvests', toNumber(r.grassHarvests))
      // sheep/goat sellCount is a v1 addition; carry it through if present.
      set(out, 'sellCount', toNumber(r.sellCount))
      break
    }
    case 'pig': {
      set(out, 'provideStraw', toBool(r.provideStraw))
      set(out, 'sellCount', toNumber(r.sellCount))
      set(out, 'baseCrop', toCropSlug(r.baseCrop))
      set(out, 'grainCrop', toCropSlug(r.grainCrop))
      set(out, 'proteinCrop', toCropSlug(r.proteinCrop))
      set(out, 'rootCrop', toCropSlug(r.rootCrop))
      break
    }
    case 'horse': {
      set(out, 'provideStraw', toBool(r.provideStraw))
      set(out, 'grassHarvests', toNumber(r.grassHarvests))
      set(out, 'sellCount', toNumber(r.sellCount))
      set(out, 'baseCrop', toCropSlug(r.baseCrop))
      set(out, 'rootCrop', toCropSlug(r.rootCrop))
      break
    }
  }

  return out
}
