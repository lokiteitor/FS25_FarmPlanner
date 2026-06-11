// features/machinery-manage — public API of the machinery CRUD feature slice.
//
// Higher layers (pages) import ONLY from here. The form modal owns the
// create/edit UI + error mapping; it submits through entities/machinery's store
// (FSD §8.1). The capacity helpers are exported for the machinery page table and
// the error helpers for tests.

export { default as MachineFormModal } from './ui/MachineFormModal.vue'

export { theoreticalCapacityHaPerH, formatCapacity } from './lib/capacity'

export {
  machineErrorMessage,
  machineFieldErrorsFrom,
  GENERIC_MACHINE_ERROR,
} from './lib/errorMessages'
