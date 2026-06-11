// widgets/farm-summary — public API of the dashboard summary widget.
//
// Consumed by pages/index (the dashboard). The widget is pure presentational:
// it reads the farm/field/stable/catalog stores and derives its model with the
// pure `buildFarmSummary` aggregator (also exported for unit testing).

export { default as FarmSummary } from './ui/FarmSummary.vue'

export { buildFarmSummary } from './lib/summary'
export type { FarmSummary as FarmSummaryModel, CropDistributionRow } from './lib/summary'

export {
  SPECIES_LABELS,
  speciesLabel,
  formatInteger,
  formatHectares,
  formatCurrency,
} from './lib/format'
