// features/field-manage — public API of the field create/edit/delete feature.
//
// Higher layers (pages, widgets) import ONLY from here. The modals own all UI +
// validation + error mapping and submit through entities/field's store (FSD:
// features depend on lower layers via their public APIs).

export { default as FieldFormModal } from './ui/FieldFormModal.vue'
export { default as FieldDeleteModal } from './ui/FieldDeleteModal.vue'

// Error-message helpers exported for reuse and unit testing of the mapping.
export {
  fieldErrorMessage,
  fieldScopedError,
  GENERIC_FIELD_ERROR,
} from './lib/errorMessages'
