/**
 * Seed data — game_versions (docs/seeds-catalogo.md §1).
 *
 * A single active version in v1. All other catalogs hang off this version.
 */

export interface GameVersionSeed {
  label: string;
  isActive: boolean;
  releasedAt: string | null;
}

export const gameVersionsSeed: GameVersionSeed[] = [
  { label: 'FS25 1.0', isActive: true, releasedAt: null },
];
