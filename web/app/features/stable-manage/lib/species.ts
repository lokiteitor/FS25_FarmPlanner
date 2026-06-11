// features/stable-manage/lib/species — Spanish labels for the 7 animal species
// and the per-species `Stable.config` field metadata.
//
// Labels mirror the catalog `name_es` values documented in docs/seeds-catalogo.md
// §4 (cow=Vacas, buffalo=Búfalos, …). We keep a static map here rather than
// reading the catalog because the stables UI must render even before a catalog
// load resolves (species is a closed enum, openapi AnimalSpecies).
//
// The config field descriptors drive the dynamic, species-specific section of
// the create/edit form. They reflect the documented `Stable.config` keys
// (openapi Stable.config + the per-species *Inputs schemas): feedType
// (ruminants), provideStraw, grassHarvests, silageCrop (slug), and the
// pig/horse feed-component crop slugs (baseCrop/grainCrop/proteinCrop/rootCrop).
// `difficulty`/`sellPriceType` are NOT here (they live on the farm).

import type { AnimalSpecies } from '~/entities/stable'

/** Spanish display label per species (catalog name_es). */
export const SPECIES_LABELS: Record<AnimalSpecies, string> = {
  cow: 'Vacas',
  buffalo: 'Búfalos',
  chicken: 'Gallinas',
  sheep: 'Ovejas',
  goat: 'Cabras',
  pig: 'Cerdos',
  horse: 'Caballos',
}

/** Stable display order (ruminants first, then poultry, monogastrics, equine). */
export const SPECIES_ORDER: AnimalSpecies[] = [
  'cow',
  'buffalo',
  'sheep',
  'goat',
  'chicken',
  'pig',
  'horse',
]

/** Resolve a species' Spanish label (falls back to the raw slug). */
export function speciesLabel(species: string): string {
  return SPECIES_LABELS[species as AnimalSpecies] ?? species
}

/** Select <option>s for the species picker, in {@link SPECIES_ORDER}. */
export function speciesOptions(): { label: string; value: AnimalSpecies }[] {
  return SPECIES_ORDER.map((species) => ({
    label: SPECIES_LABELS[species],
    value: species,
  }))
}

/** The kind of control to render for a config field. */
export type ConfigFieldKind = 'select' | 'boolean' | 'number' | 'crop'

/** Metadata describing one editable `Stable.config` key for a species. */
export interface ConfigFieldDef {
  /** The `Stable.config` key. */
  key: string
  /** Spanish label shown in the form. */
  label: string
  kind: ConfigFieldKind
  /** For `select`: the allowed values + Spanish labels. */
  options?: { label: string; value: string }[]
  /** Helper text shown under the control. */
  helper?: string
}

/** Ruminant feed-type options (cow allows `simple`, buffalo does not). */
const FEED_TYPE_OPTIONS_FULL = [
  { label: 'TMR (ración total mezclada)', value: 'tmr' },
  { label: 'Simple', value: 'simple' },
  { label: 'Heno', value: 'hay' },
  { label: 'Hierba', value: 'grass' },
]
const FEED_TYPE_OPTIONS_NO_SIMPLE = FEED_TYPE_OPTIONS_FULL.filter(
  (o) => o.value !== 'simple',
)

const FEED_TYPE_FIELD = (allowSimple: boolean): ConfigFieldDef => ({
  key: 'feedType',
  label: 'Tipo de alimentación',
  kind: 'select',
  options: allowSimple ? FEED_TYPE_OPTIONS_FULL : FEED_TYPE_OPTIONS_NO_SIMPLE,
  helper: 'Determina el factor de productividad del rebaño.',
})

const PROVIDE_STRAW_FIELD: ConfigFieldDef = {
  key: 'provideStraw',
  label: 'Aportar paja',
  kind: 'boolean',
  helper: 'Bonificación de producción por aportar paja.',
}

const GRASS_HARVESTS_FIELD: ConfigFieldDef = {
  key: 'grassHarvests',
  label: 'Cosechas de hierba/año',
  kind: 'number',
}

const SILAGE_CROP_FIELD: ConfigFieldDef = {
  key: 'silageCrop',
  label: 'Cultivo de ensilaje (slug)',
  kind: 'crop',
  helper: 'Slug del cultivo usado para ensilaje (opcional).',
}

/**
 * Editable `Stable.config` fields per species. The backend validates these with
 * zod by species; we render only the documented keys for each (openapi).
 */
export const SPECIES_CONFIG_FIELDS: Record<AnimalSpecies, ConfigFieldDef[]> = {
  cow: [FEED_TYPE_FIELD(true), PROVIDE_STRAW_FIELD, GRASS_HARVESTS_FIELD, SILAGE_CROP_FIELD],
  buffalo: [FEED_TYPE_FIELD(false), PROVIDE_STRAW_FIELD, GRASS_HARVESTS_FIELD, SILAGE_CROP_FIELD],
  sheep: [GRASS_HARVESTS_FIELD],
  goat: [GRASS_HARVESTS_FIELD],
  chicken: [],
  pig: [
    PROVIDE_STRAW_FIELD,
    { key: 'baseCrop', label: 'Cultivo base (slug)', kind: 'crop' },
    { key: 'grainCrop', label: 'Cultivo de grano (slug)', kind: 'crop' },
    { key: 'proteinCrop', label: 'Cultivo proteico (slug)', kind: 'crop' },
    { key: 'rootCrop', label: 'Cultivo de raíz (slug)', kind: 'crop' },
  ],
  horse: [
    PROVIDE_STRAW_FIELD,
    GRASS_HARVESTS_FIELD,
    { key: 'baseCrop', label: 'Cultivo base (slug)', kind: 'crop' },
    { key: 'rootCrop', label: 'Cultivo de raíz (slug)', kind: 'crop' },
  ],
}

/** Config field descriptors for a species (empty array for chicken). */
export function configFieldsFor(species: AnimalSpecies): ConfigFieldDef[] {
  return SPECIES_CONFIG_FIELDS[species] ?? []
}
