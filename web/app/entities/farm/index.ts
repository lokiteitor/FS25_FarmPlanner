// entities/farm — public API of the farm ("partida") slice.
//
// Higher layers (app, pages, widgets, features) import ONLY from here; the
// internal model/api modules are private to the slice (FSD cross-slice rule).

export { useFarmStore } from './model/farm.store'

export * as farmApi from './api/farmApi'

export type {
  Farm,
  FarmCreate,
  FarmUpdate,
  FarmUpdateResult,
  UserSettings,
  UserSettingsUpdate,
  UserTheme,
  Difficulty,
  SellPriceType,
} from './model/types'
