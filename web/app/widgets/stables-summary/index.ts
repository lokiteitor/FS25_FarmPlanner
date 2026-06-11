// widgets/stables-summary — public API of the stables-summary widget.
//
// The stables page imports the component from here. The pure aggregation helpers
// are exported too (for the page's own KPIs and for unit tests).

export { default as StablesSummary } from './ui/StablesSummary.vue'

export { summarizeBySpecies, totalsOf, utilizationOf } from './lib/summarize'
export type { SpeciesSummary, StablesTotals } from './lib/summarize'
