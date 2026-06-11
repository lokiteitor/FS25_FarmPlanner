/**
 * Seed data — crops (25) (docs/seeds-catalogo.md §2).
 *
 * Values are copied VERBATIM from the spec JSON. yield_per_m2 in L/m²,
 * base_price in $/L, max_price_factor seasonal multiplier, seed_rate in L/m²,
 * weight_per_liter in t/m³.
 */

export interface CropSeed {
  slug: string;
  nameEs: string;
  nameEn: string;
  yieldPerM2: number;
  basePrice: number;
  maxPriceFactor: number;
  seedRate: number;
  weightPerLiter: number;
}

export const cropsSeed: CropSeed[] = [
  { slug: 'barley', nameEs: 'Cebada', nameEn: 'Barley', yieldPerM2: 0.96, basePrice: 0.313, maxPriceFactor: 1.21, seedRate: 0.0265, weightPerLiter: 0.68 },
  { slug: 'onion', nameEs: 'Cebollas', nameEn: 'Onion', yieldPerM2: 7.0, basePrice: 0.75, maxPriceFactor: 3.0, seedRate: 0.0005, weightPerLiter: 1.0 },
  { slug: 'redbeet', nameEs: 'Remolacha', nameEn: 'Red Beet', yieldPerM2: 5.78, basePrice: 0.122, maxPriceFactor: 1.15, seedRate: 0.004, weightPerLiter: 0.52 },
  { slug: 'canola', nameEs: 'Canola', nameEn: 'Canola', yieldPerM2: 0.58, basePrice: 0.603, maxPriceFactor: 1.21, seedRate: 0.0049, weightPerLiter: 0.6 },
  { slug: 'carrot', nameEs: 'Zanahoria', nameEn: 'Carrot', yieldPerM2: 7.7, basePrice: 0.132, maxPriceFactor: 1.15, seedRate: 0.001, weightPerLiter: 0.64 },
  { slug: 'corn', nameEs: 'Maíz', nameEn: 'Maize', yieldPerM2: 0.92, basePrice: 0.38, maxPriceFactor: 1.33, seedRate: 0.0053, weightPerLiter: 0.8 },
  { slug: 'cotton', nameEs: 'Algodón', nameEn: 'Cotton', yieldPerM2: 0.497, basePrice: 1.252, maxPriceFactor: 1.11, seedRate: 0.005, weightPerLiter: 0.23 },
  { slug: 'grape', nameEs: 'Uva', nameEn: 'Grape', yieldPerM2: 1.84, basePrice: 0.603, maxPriceFactor: 1.2, seedRate: 0.0, weightPerLiter: 0.6 },
  { slug: 'green_beans', nameEs: 'Judías Verdes', nameEn: 'Green Beans', yieldPerM2: 0.6975, basePrice: 0.72, maxPriceFactor: 1.05, seedRate: 0.028, weightPerLiter: 0.42 },
  { slug: 'oat', nameEs: 'Avena', nameEn: 'Oat', yieldPerM2: 0.57, basePrice: 0.532, maxPriceFactor: 1.21, seedRate: 0.034, weightPerLiter: 0.5 },
  { slug: 'olive', nameEs: 'Oliva', nameEn: 'Olive', yieldPerM2: 1.84, basePrice: 0.603, maxPriceFactor: 1.2, seedRate: 0.0, weightPerLiter: 0.6 },
  { slug: 'parsnip', nameEs: 'Chirivía', nameEn: 'Parsnip', yieldPerM2: 6.95, basePrice: 0.131, maxPriceFactor: 1.15, seedRate: 0.001, weightPerLiter: 0.58 },
  { slug: 'pea', nameEs: 'Guisantes', nameEn: 'Pea', yieldPerM2: 0.96, basePrice: 1.04, maxPriceFactor: 1.1, seedRate: 0.025, weightPerLiter: 0.72 },
  { slug: 'potato', nameEs: 'Patatas', nameEn: 'Potato', yieldPerM2: 4.13, basePrice: 0.222, maxPriceFactor: 1.15, seedRate: 0.3733, weightPerLiter: 0.75 },
  { slug: 'rice_long_grain', nameEs: 'Arroz (Largo)', nameEn: 'Rice (Long Grain)', yieldPerM2: 0.9, basePrice: 0.53, maxPriceFactor: 1.05, seedRate: 0.05, weightPerLiter: 0.77 },
  { slug: 'rice', nameEs: 'Arroz (Corto)', nameEn: 'Rice', yieldPerM2: 0.66, basePrice: 1.1, maxPriceFactor: 1.05, seedRate: 0.015625, weightPerLiter: 0.79 },
  { slug: 'sorghum', nameEs: 'Sorgo', nameEn: 'Sorghum', yieldPerM2: 0.82, basePrice: 0.43, maxPriceFactor: 1.22, seedRate: 0.0035, weightPerLiter: 0.85 },
  { slug: 'soybean', nameEs: 'Soja', nameEn: 'Soybean', yieldPerM2: 0.45, basePrice: 0.778, maxPriceFactor: 1.59, seedRate: 0.0214, weightPerLiter: 0.7 },
  { slug: 'spinach', nameEs: 'Espinacas', nameEn: 'Spinach', yieldPerM2: 2.31, basePrice: 0.22, maxPriceFactor: 1.05, seedRate: 0.001, weightPerLiter: 0.13 },
  { slug: 'sugarbeet', nameEs: 'Remolacha Azucarera', nameEn: 'Sugar Beet', yieldPerM2: 5.78, basePrice: 0.172, maxPriceFactor: 1.15, seedRate: 0.0034, weightPerLiter: 0.7 },
  { slug: 'sugarcane', nameEs: 'Caña de Azúcar', nameEn: 'Sugarcane', yieldPerM2: 11.34, basePrice: 0.119, maxPriceFactor: 1.05, seedRate: 1.2, weightPerLiter: 0.18 },
  { slug: 'sunflower', nameEs: 'Girasol', nameEn: 'Sunflower', yieldPerM2: 0.52, basePrice: 0.673, maxPriceFactor: 1.2, seedRate: 0.0143, weightPerLiter: 0.35 },
  { slug: 'wheat', nameEs: 'Trigo', nameEn: 'Wheat', yieldPerM2: 0.89, basePrice: 0.337, maxPriceFactor: 1.21, seedRate: 0.0308, weightPerLiter: 0.78 },
  { slug: 'grass', nameEs: 'Hierba', nameEn: 'Grass', yieldPerM2: 4.37, basePrice: 0.045, maxPriceFactor: 1.11, seedRate: 0.012, weightPerLiter: 0.3 },
  { slug: 'poplar', nameEs: 'Álamo (Astillas de Madera)', nameEn: 'Poplar (Wood Chips)', yieldPerM2: 19.881, basePrice: 0.32, maxPriceFactor: 1.69, seedRate: 0.15, weightPerLiter: 0.35 },
];
