// entities/field — public API of the field ("campo") slice.
//
// Higher layers (app, pages, widgets, features) import ONLY from here; the
// internal model/api modules are private to the slice (FSD cross-slice rule).

export { useFieldStore } from './model/field.store'

export * as fieldApi from './api/fieldApi'

export type { Field, FieldCreate, FieldHarvestBody, FieldStatus, FieldUpdate } from './model/types'
