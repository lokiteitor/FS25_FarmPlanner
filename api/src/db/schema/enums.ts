import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Global PostgreSQL enums.
 *
 * These mirror `docs/base-de-datos.md` exactly. The same values are also used
 * as literal unions across zod schemas; keep both in sync if FS25 adds a value
 * (e.g. `ALTER TYPE animal_species ADD VALUE ...`).
 */

export const difficultyEnum = pgEnum('difficulty', ['easy', 'normal', 'hard']);

export const sellPriceTypeEnum = pgEnum('sell_price_type', [
  'baseline',
  'max_seasonal',
]);

export const animalSpeciesEnum = pgEnum('animal_species', [
  'cow',
  'buffalo',
  'chicken',
  'sheep',
  'goat',
  'pig',
  'horse',
]);

export const fieldStatusEnum = pgEnum('field_status', ['fallow', 'sown']);

export type Difficulty = (typeof difficultyEnum.enumValues)[number];
export type SellPriceType = (typeof sellPriceTypeEnum.enumValues)[number];
export type AnimalSpecies = (typeof animalSpeciesEnum.enumValues)[number];
export type FieldStatus = (typeof fieldStatusEnum.enumValues)[number];
