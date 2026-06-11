// features/stable-manage — public API of the stable CRUD feature slice.
//
// Higher layers (pages, widgets) import ONLY from here. The form modal owns the
// create/edit UI + error mapping; it submits through entities/stable's store
// (FSD §8.1). Species labels + config-field metadata are exported for the
// stables page/widget (catalog name_es labels) and the error helpers for tests.

export { default as StableFormModal } from './ui/StableFormModal.vue'

export {
  SPECIES_LABELS,
  SPECIES_ORDER,
  speciesLabel,
  speciesOptions,
  configFieldsFor,
  SPECIES_CONFIG_FIELDS,
} from './lib/species'
export type { ConfigFieldDef, ConfigFieldKind } from './lib/species'

export {
  stableErrorMessage,
  stableFieldErrorsFrom,
  GENERIC_STABLE_ERROR,
} from './lib/errorMessages'
