/**
 * Seed data — silage_crops (10) (docs/seeds-catalogo.md §3).
 *
 * Each references a crop by slug (same game_version). The silage yield is its
 * OWN value, not derived from the base crop (e.g. poplar silage 6.627 vs crop
 * 19.881). Silage price/density are global (game_constants).
 */

export interface SilageCropSeed {
  cropSlug: string;
  yieldPerM2: number;
  chaffFactor: number;
}

export const silageCropsSeed: SilageCropSeed[] = [
  { cropSlug: 'barley', yieldPerM2: 0.96, chaffFactor: 4.0 },
  { cropSlug: 'canola', yieldPerM2: 0.58, chaffFactor: 4.0 },
  { cropSlug: 'corn', yieldPerM2: 0.92, chaffFactor: 7.8 },
  { cropSlug: 'oat', yieldPerM2: 0.57, chaffFactor: 4.0 },
  { cropSlug: 'sorghum', yieldPerM2: 0.82, chaffFactor: 4.0 },
  { cropSlug: 'soybean', yieldPerM2: 0.45, chaffFactor: 4.0 },
  { cropSlug: 'sunflower', yieldPerM2: 0.52, chaffFactor: 6.0 },
  { cropSlug: 'wheat', yieldPerM2: 0.89, chaffFactor: 4.0 },
  { cropSlug: 'grass', yieldPerM2: 4.37, chaffFactor: 1.0 },
  { cropSlug: 'poplar', yieldPerM2: 6.627, chaffFactor: 3.0 },
];
