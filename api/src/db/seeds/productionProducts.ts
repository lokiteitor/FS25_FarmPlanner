/**
 * Seed data — production products (FS25 v1.0).
 *
 * Non-crop materials used as inputs or produced as outputs in production
 * chains. These are the goods that cannot be represented by a crops.slug:
 *   - Manufactured goods (flour, oil, bread, fabric, clothing, rope, …)
 *   - Raw materials not modelled as crops (wood, stone, wool)
 *
 * Crop slugs (wheat, barley, canola, sunflower, rice, …) are NOT duplicated
 * here — they are referenced directly from crops.slug in the chain definitions.
 */

export interface ProductionProductSeed {
  slug: string;
  nameEs: string;
  nameEn: string;
}

export const productionProductsSeed: ProductionProductSeed[] = [
  // -- Raw materials (non-crop inputs) --
  { slug: 'wood',          nameEs: 'Madera',              nameEn: 'Wood' },
  { slug: 'stone',         nameEs: 'Piedra',              nameEn: 'Stone' },
  { slug: 'wool',          nameEs: 'Lana',                nameEn: 'Wool' },

  // -- Milling outputs --
  { slug: 'flour',         nameEs: 'Harina',              nameEn: 'Flour' },
  { slug: 'rice_flour',    nameEs: 'Harina de Arroz',     nameEn: 'Rice Flour' },

  // -- Oil mill outputs --
  { slug: 'oil',           nameEs: 'Aceite',              nameEn: 'Oil' },

  // -- Bakery outputs --
  { slug: 'bread',         nameEs: 'Pan',                 nameEn: 'Bread' },

  // -- Textile outputs --
  { slug: 'fabric',        nameEs: 'Tela',                nameEn: 'Fabric' },
  { slug: 'clothing',      nameEs: 'Ropa',                nameEn: 'Clothing' },
  { slug: 'rope',          nameEs: 'Cuerda',              nameEn: 'Rope' },

  // -- Sawmill outputs --
  { slug: 'planks',        nameEs: 'Tablas',              nameEn: 'Planks' },
  { slug: 'long_planks',   nameEs: 'Tablas Largas',       nameEn: 'Long Planks' },
  { slug: 'beams',         nameEs: 'Vigas',               nameEn: 'Beams' },
  { slug: 'walls',         nameEs: 'Muros Prefabricados', nameEn: 'Prefabricated Walls' },

  // -- Paper factory outputs --
  { slug: 'cardboard',     nameEs: 'Cartón',              nameEn: 'Cardboard' },
  { slug: 'paper',         nameEs: 'Papel',               nameEn: 'Paper' },

  // -- Cement factory outputs --
  { slug: 'bricks',        nameEs: 'Ladrillos',           nameEn: 'Bricks' },
  { slug: 'roof_tiles',    nameEs: 'Tejas',               nameEn: 'Roof Tiles' },
  { slug: 'cement_bags',   nameEs: 'Sacos de Cemento',    nameEn: 'Cement Bags' },

  // -- Greenhouse inputs --
  { slug: 'water',         nameEs: 'Agua',                nameEn: 'Water' },

  // -- Greenhouse outputs --
  { slug: 'lettuce',       nameEs: 'Lechuga',             nameEn: 'Lettuce' },
  { slug: 'tomato',        nameEs: 'Tomate',              nameEn: 'Tomato' },
  { slug: 'strawberry',    nameEs: 'Fresa',               nameEn: 'Strawberry' },
  { slug: 'spring_onion',  nameEs: 'Cebollín',            nameEn: 'Spring Onion' },
  { slug: 'napa_cabbage',  nameEs: 'Col China',           nameEn: 'Napa Cabbage' },
  { slug: 'chili',         nameEs: 'Chile',               nameEn: 'Chili' },
  { slug: 'garlic',        nameEs: 'Ajo',                 nameEn: 'Garlic' },
];
