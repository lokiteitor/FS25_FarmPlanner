// features/calculator-config — public API of the calculator-config feature.
//
// Higher layers (pages) import ONLY from here. Exposes the config bar component
// and the orchestration composable; the api module is private to the slice.

export { default as CalculatorConfig } from './ui/CalculatorConfig.vue'

export { useCalculatorConfig } from './model/useCalculatorConfig'
export type { UseCalculatorConfig } from './model/useCalculatorConfig'

export { defaultInputsFor } from './model/defaults'

export type {
  AnimalConfig,
  AnimalConfigInputs,
  BaseAnimalInputs,
  CowInputs,
  BuffaloInputs,
  ChickenInputs,
  SheepInputs,
  GoatInputs,
  PigInputs,
  HorseInputs,
  FeedType,
  CowBreed,
  BoughtFeedType,
  AnimalSpecies,
} from './model/types'
