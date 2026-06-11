// widgets/farm-summary/lib/format — small pure formatting helpers (Spanish
// locale) for the dashboard. Kept separate so they can be unit-tested without
// the component.

import type { AnimalSpecies } from '~/entities/stable'

/** Spanish display names per animal species. */
export const SPECIES_LABELS: Record<AnimalSpecies, string> = {
  cow: 'Vacas',
  buffalo: 'Búfalos',
  chicken: 'Gallinas',
  sheep: 'Ovejas',
  goat: 'Cabras',
  pig: 'Cerdos',
  horse: 'Caballos',
}

/** Human-readable species label (falls back to the raw species key). */
export function speciesLabel(species: string): string {
  return SPECIES_LABELS[species as AnimalSpecies] ?? species
}

const integerFmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })

/** Format an integer-ish number with es-ES grouping (no decimals). */
export function formatInteger(value: number): string {
  return integerFmt.format(Math.round(value))
}

/** Format hectares with up to one decimal (es-ES). */
export function formatHectares(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)
}

/** Format a currency amount as a whole-number $ value (es-ES grouping). */
export function formatCurrency(value: number): string {
  return `$${integerFmt.format(Math.round(value))}`
}
