/**
 * Seed data — production building types (FS25 v1.0).
 *
 * Each building type groups the chains (recipes) that can run inside it.
 * The `slug` is the key used in production_chains.building_type_slug and
 * in production_buildings.building_type_slug (user domain).
 */

export interface ProductionBuildingTypeSeed {
  slug: string;
  nameEs: string;
  nameEn: string;
}

export const productionBuildingTypesSeed: ProductionBuildingTypeSeed[] = [
  { slug: 'mill',             nameEs: 'Molino',              nameEn: 'Mill' },
  { slug: 'bakery',           nameEs: 'Panadería',           nameEn: 'Bakery' },
  { slug: 'oil_mill',         nameEs: 'Almazara',            nameEn: 'Oil Mill' },
  { slug: 'spinnery',         nameEs: 'Hilandería',          nameEn: 'Spinnery' },
  { slug: 'tailor_shop',      nameEs: 'Sastrería',           nameEn: 'Tailor Shop' },
  { slug: 'sawmill',          nameEs: 'Aserradero',          nameEn: 'Sawmill' },
  { slug: 'paper_factory',    nameEs: 'Fábrica de Papel',    nameEn: 'Paper Factory' },
  { slug: 'ropery',           nameEs: 'Cordelería',          nameEn: 'Ropery' },
  { slug: 'cement_factory',   nameEs: 'Fábrica de Cemento',  nameEn: 'Cement Factory' },
  { slug: 'greenhouse',       nameEs: 'Invernadero',         nameEn: 'Greenhouse' },
];
