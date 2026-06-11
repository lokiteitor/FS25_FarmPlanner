// widgets/animal-calculator-panels/lib — internal helpers re-exported for the
// widget's own components and its public model. Not a cross-slice public API.

export {
  SPECIES_META,
  rateLabelEs,
  FEED_TYPE_LABELS_ES,
  FEED_COMPONENT_LABELS_ES,
  COW_BREED_LABELS_ES,
} from './speciesMeta'
export type { SpeciesMeta, SpeciesFieldVisibility } from './speciesMeta'

export { fmtInt, fmtDec, fmtMoney, fmtPercent } from './format'
