// features/data-migration — public API of the IndexedDB→API migration feature
// (H8). Higher layers (the /migrate page) import ONLY from here.
//
// Exposes the migration panel component plus the pure lib/model symbols that are
// useful to compose or test (export/import functions, the documented shape + its
// zod validator, and the auditable crop-name fallback map).

export { default as MigratePanel } from './ui/MigratePanel.vue'

// H8.1 — IndexedDB export.
export {
  DEFAULT_PROTOTYPE_DB_NAME,
  downloadJson,
  exportFromIndexedDb,
  isIndexedDbAvailable,
  listPrototypeDatabases,
} from './lib/exportIndexedDb'

// H8.2 — import against the API.
export { importPrototype, defaultImportDeps } from './lib/importMigration'
export type { ImportDeps, ImportOptions } from './lib/importMigration'

// Crop name → slug resolution (live catalog + auditable fallback map).
export { resolveCropSlug, normalize, CROP_NAME_FALLBACKS } from './lib/resolveCropSlug'
export type { ResolverCrop } from './lib/resolveCropSlug'

// Prototype per-species calculator inputs → API AnimalConfigInputs encoding.
export { translateAnimalConfig } from './lib/translateAnimalConfig'

// Documented migration shape, report types and the lenient zod validator.
export {
  prototypeExportSchema,
  parsePrototypeExport,
  DIFFICULTIES,
  SELL_PRICE_TYPES,
} from './model/types'
export type {
  PrototypeExport,
  PrototypeSettings,
  PrototypeField,
  PrototypeStable,
  PrototypeMachine,
  ImportReport,
  UnresolvedCrop,
  ParsedPrototypeExport,
} from './model/types'
