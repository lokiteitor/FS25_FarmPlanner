// features/farm-switcher — public API of the active-farm picker + partida CRUD.
//
// Higher layers (widgets/app-sidebar, pages) import ONLY from here. The switcher
// component drives farm selection (entities/farm) and catalog reloading
// (entities/catalog) through their stores; the manage modal handles
// create/edit/delete. Spanish UI.

export { default as FarmSwitcher } from './ui/FarmSwitcher.vue'
export { default as FarmManageModal } from './ui/FarmManageModal.vue'

export {
  DIFFICULTY_LABELS,
  SELL_PRICE_TYPE_LABELS,
  DIFFICULTY_OPTIONS,
  SELL_PRICE_TYPE_OPTIONS,
  difficultyLabel,
  sellPriceTypeLabel,
} from './lib/options'
