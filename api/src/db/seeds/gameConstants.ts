/**
 * Seed data — game_constants (KV, JSONB) (docs/seeds-catalogo.md §5).
 *
 * Global balance constants not tied to a species. Stored one row per key. Long
 * decimals are written as JSON numbers (never strings). milk_price_scalars
 * month names are in English; note AUG (not AGU) per correction #4, and the
 * game year starts in March (month 1 = MAR).
 */

export interface MilkMonthlyScalar {
  month: number;
  name: string;
  value: number;
}

export interface MilkPriceScalars {
  average: number;
  max: number;
  monthly: MilkMonthlyScalar[];
}

export interface GameConstantsSeed {
  default_yield_bonus: number;
  straw_bonus: number;
  mineral_feed_price: number;
  silage_price: number;
  silage_weight: number;
  straw_yield_per_m2: number;
  grass_yield_per_m2: number;
  income_difficulty_scalars: { easy: number; normal: number; hard: number };
  milk_price_scalars: MilkPriceScalars;
  feed_purchase_prices: Record<string, number>;
  yield_bonus_scalar: number;
}

export const gameConstantsSeed: GameConstantsSeed = {
  default_yield_bonus: 0.425,
  straw_bonus: 0.11111111,
  mineral_feed_price: 0.9523809524,
  silage_price: 0.121,
  silage_weight: 0.3,
  straw_yield_per_m2: 5.244,
  grass_yield_per_m2: 4.37,
  income_difficulty_scalars: { easy: 3.0, normal: 1.8, hard: 1.0 },
  milk_price_scalars: {
    average: 1.003333333,
    max: 1.09,
    monthly: [
      { month: 1, name: 'MAR', value: 1.06 },
      { month: 2, name: 'APR', value: 1.01 },
      { month: 3, name: 'MAY', value: 0.96 },
      { month: 4, name: 'JUN', value: 0.90 },
      { month: 5, name: 'JUL', value: 0.95 },
      { month: 6, name: 'AUG', value: 0.95 },
      { month: 7, name: 'SEP', value: 1.03 },
      { month: 8, name: 'OCT', value: 1.09 },
      { month: 9, name: 'NOV', value: 0.98 },
      { month: 10, name: 'DEC', value: 0.96 },
      { month: 11, name: 'JAN', value: 1.08 },
      { month: 12, name: 'FEB', value: 1.07 },
    ],
  },
  feed_purchase_prices: { oat: 1.4, wheat: 1.5 },
  yield_bonus_scalar: 1.425,
};
