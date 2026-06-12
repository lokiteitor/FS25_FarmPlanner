// features/production-manage/lib/buildingTypes — static labels and helpers
// for production building types (slug → Spanish display name).
//
// These labels are used in dropdowns and display; the canonical names come from
// the catalog store but these provide a fallback while loading.

export const BUILDING_TYPE_LABELS: Record<string, string> = {
  mill: 'Molino',
  bakery: 'Panadería',
  oil_mill: 'Almazara',
  spinnery: 'Hilandería',
  tailor_shop: 'Sastrería',
  sawmill: 'Aserradero',
  paper_factory: 'Fábrica de Papel',
  ropery: 'Cordelería',
  cement_factory: 'Fábrica de Cemento',
  greenhouse: 'Invernadero',
}

/** Resolve a display label for a building type slug. Falls back to the raw slug. */
export function buildingTypeLabel(slug: string): string {
  return BUILDING_TYPE_LABELS[slug] ?? slug
}
