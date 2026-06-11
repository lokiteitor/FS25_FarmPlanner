// entities/stable — public API of the stable ("establo") slice.
//
// Higher layers (app, pages, widgets, features) import ONLY from here; the
// internal model/api modules are private to the slice (FSD cross-slice rule).

export { useStableStore } from './model/stable.store'

export * as stableApi from './api/stableApi'

export type {
  Stable,
  StableCreate,
  StableUpdate,
  StableConfig,
  AnimalSpecies,
} from './model/types'
