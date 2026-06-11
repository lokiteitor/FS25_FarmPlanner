// widgets/stables-summary/lib/summarize — pure aggregation of a farm's stables
// into per-species totals (head count, capacity, utilization) plus a grand
// total. No stores/no network; the widget passes its loaded stables in.
//
// Utilization = currentCount / maxCapacity, clamped to [0, ∞) and expressed as
// a 0..1 ratio (the widget formats it as a %). Species with zero capacity report
// 0 utilization (avoid divide-by-zero).

import type { AnimalSpecies, Stable } from '~/entities/stable'

/** Consolidated totals for one species. */
export interface SpeciesSummary {
  species: AnimalSpecies
  /** How many stables of this species exist. */
  stableCount: number
  /** Sum of currentCount across the species' stables. */
  animals: number
  /** Sum of maxCapacity across the species' stables. */
  capacity: number
  /** animals / capacity (0..1; 0 when capacity is 0). */
  utilization: number
}

/** Grand totals across all species. */
export interface StablesTotals {
  stableCount: number
  animals: number
  capacity: number
  utilization: number
}

/** animals / capacity, guarding against a zero denominator. */
export function utilizationOf(animals: number, capacity: number): number {
  if (capacity <= 0) return 0
  return animals / capacity
}

/**
 * Group `stables` by species and compute per-species totals. Only species that
 * actually have at least one stable are returned, in first-seen order to keep
 * the table stable; the page may re-sort by {@link SpeciesSummary.species}.
 */
export function summarizeBySpecies(stables: Stable[]): SpeciesSummary[] {
  const map = new Map<AnimalSpecies, SpeciesSummary>()

  for (const stable of stables) {
    const entry = map.get(stable.species) ?? {
      species: stable.species,
      stableCount: 0,
      animals: 0,
      capacity: 0,
      utilization: 0,
    }
    entry.stableCount += 1
    entry.animals += stable.currentCount
    entry.capacity += stable.maxCapacity
    map.set(stable.species, entry)
  }

  const summaries = [...map.values()]
  for (const s of summaries) {
    s.utilization = utilizationOf(s.animals, s.capacity)
  }
  return summaries
}

/** Grand totals across all stables (sum of all species). */
export function totalsOf(stables: Stable[]): StablesTotals {
  let animals = 0
  let capacity = 0
  for (const stable of stables) {
    animals += stable.currentCount
    capacity += stable.maxCapacity
  }
  return {
    stableCount: stables.length,
    animals,
    capacity,
    utilization: utilizationOf(animals, capacity),
  }
}
