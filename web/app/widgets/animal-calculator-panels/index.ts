// widgets/animal-calculator-panels — public API of the species calculator panel
// set. Pages import ONLY from here. The orchestrator renders the Inputs,
// Production and Fieldwork/Feed panels for one species, driven by the pure engine.

export { default as AnimalCalculatorPanels } from './ui/AnimalCalculatorPanels.vue'
export { default as AnimalCalculatorScreen } from './ui/AnimalCalculatorScreen.vue'

export { useAnimalProjection, toEngineInputs } from './model/useAnimalProjection'
export { useAnimalCalculatorScreen } from './model/useAnimalCalculatorScreen'
export type { AnimalCalculatorScreen as AnimalCalculatorScreenState } from './model/useAnimalCalculatorScreen'

export {
  SPECIES_META,
  rateLabelEs,
  FEED_TYPE_LABELS_ES,
  FEED_COMPONENT_LABELS_ES,
  COW_BREED_LABELS_ES,
} from './lib/speciesMeta'
export type { SpeciesMeta, SpeciesFieldVisibility } from './lib/speciesMeta'
