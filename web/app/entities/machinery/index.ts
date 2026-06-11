// entities/machinery — public API of the machinery ("maquinaria") slice.
//
// Higher layers (app, pages, widgets, features) import ONLY from here; the
// internal model/api modules are private to the slice (FSD cross-slice rule).

export { useMachineryStore } from './model/machinery.store'

export * as machineryApi from './api/machineryApi'

export type { Machine, MachineCreate, MachineUpdate } from './model/types'
