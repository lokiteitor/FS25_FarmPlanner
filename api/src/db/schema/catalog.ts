import {
  pgTable,
  uuid,
  varchar,
  boolean,
  date,
  jsonb,
  timestamp,
  unique,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { uuidv7, numeric } from './types';
import { animalSpeciesEnum } from './enums';

/**
 * Módulo: Catálogo del Juego (versionado) — game_versions, crops,
 * silage_crops, animal_types, game_constants.
 *
 * All numeric columns use { mode: 'number' } so DB numerics align with the
 * OpenAPI `number` types and the JS calc engine (ADR-002).
 */

// 4. game_versions
export const gameVersions = pgTable(
  'game_versions',
  {
    id: uuid('id').primaryKey().default(uuidv7()),
    label: varchar('label', { length: 50 }).notNull(),
    isActive: boolean('is_active').notNull().default(false),
    releasedAt: date('released_at'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique('game_versions_label_unique').on(t.label),
    // Partial unique index: at most one active version.
    uniqueIndex('one_active_game_version')
      .on(t.isActive)
      .where(sql`is_active`),
  ],
);

// 5. crops
export const crops = pgTable(
  'crops',
  {
    id: uuid('id').primaryKey().default(uuidv7()),
    gameVersionId: uuid('game_version_id')
      .notNull()
      .references(() => gameVersions.id, { onDelete: 'restrict' }),
    slug: varchar('slug', { length: 50 }).notNull(),
    nameEs: varchar('name_es', { length: 100 }).notNull(),
    nameEn: varchar('name_en', { length: 100 }).notNull(),
    yieldPerM2: numeric('yield_per_m2', {
      precision: 10,
      scale: 4,
      mode: 'number',
    }).notNull(),
    basePrice: numeric('base_price', {
      precision: 10,
      scale: 4,
      mode: 'number',
    }).notNull(),
    maxPriceFactor: numeric('max_price_factor', {
      precision: 6,
      scale: 3,
      mode: 'number',
    }).notNull(),
    seedRate: numeric('seed_rate', {
      precision: 12,
      scale: 6,
      mode: 'number',
    }).notNull(),
    weightPerLiter: numeric('weight_per_liter', {
      precision: 6,
      scale: 3,
      mode: 'number',
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique('crops_version_slug_unique').on(t.gameVersionId, t.slug),
    check('crops_yield_positive', sql`${t.yieldPerM2} > 0`),
    check('crops_price_non_negative', sql`${t.basePrice} >= 0`),
    check('crops_max_factor_positive', sql`${t.maxPriceFactor} > 0`),
    check('crops_seed_non_negative', sql`${t.seedRate} >= 0`),
    check('crops_weight_positive', sql`${t.weightPerLiter} > 0`),
  ],
);

// 6. silage_crops
export const silageCrops = pgTable(
  'silage_crops',
  {
    id: uuid('id').primaryKey().default(uuidv7()),
    gameVersionId: uuid('game_version_id')
      .notNull()
      .references(() => gameVersions.id, { onDelete: 'restrict' }),
    cropId: uuid('crop_id')
      .notNull()
      .references(() => crops.id, { onDelete: 'cascade' }),
    yieldPerM2: numeric('yield_per_m2', {
      precision: 10,
      scale: 4,
      mode: 'number',
    }).notNull(),
    chaffFactor: numeric('chaff_factor', {
      precision: 6,
      scale: 3,
      mode: 'number',
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique('silage_crops_version_crop_unique').on(t.gameVersionId, t.cropId),
    check('silage_crops_yield_positive', sql`${t.yieldPerM2} > 0`),
    check('silage_crops_chaff_positive', sql`${t.chaffFactor} > 0`),
  ],
);

// 7. animal_types
export const animalTypes = pgTable(
  'animal_types',
  {
    id: uuid('id').primaryKey().default(uuidv7()),
    gameVersionId: uuid('game_version_id')
      .notNull()
      .references(() => gameVersions.id, { onDelete: 'restrict' }),
    species: animalSpeciesEnum('species').notNull(),
    nameEs: varchar('name_es', { length: 100 }).notNull(),
    difficultyScalarEasy: numeric('difficulty_scalar_easy', {
      precision: 6,
      scale: 3,
      mode: 'number',
    })
      .notNull()
      .default(3.0),
    difficultyScalarNormal: numeric('difficulty_scalar_normal', {
      precision: 6,
      scale: 3,
      mode: 'number',
    })
      .notNull()
      .default(1.8),
    difficultyScalarHard: numeric('difficulty_scalar_hard', {
      precision: 6,
      scale: 3,
      mode: 'number',
    })
      .notNull()
      .default(1.0),
    salePrice: numeric('sale_price', {
      precision: 12,
      scale: 2,
      mode: 'number',
    }),
    productSlug: varchar('product_slug', { length: 50 }),
    productBasePrice: numeric('product_base_price', {
      precision: 10,
      scale: 4,
      mode: 'number',
    }),
    productPriceScalar: numeric('product_price_scalar', {
      precision: 8,
      scale: 4,
      mode: 'number',
    }),
    monthlyRates: jsonb('monthly_rates')
      .$type<Record<string, number>>()
      .notNull(),
    feedOptions: jsonb('feed_options')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique('animal_types_version_species_unique').on(
      t.gameVersionId,
      t.species,
    ),
    check(
      'animal_types_scalar_easy_positive',
      sql`${t.difficultyScalarEasy} > 0`,
    ),
    check(
      'animal_types_scalar_normal_positive',
      sql`${t.difficultyScalarNormal} > 0`,
    ),
    check(
      'animal_types_scalar_hard_positive',
      sql`${t.difficultyScalarHard} > 0`,
    ),
    check(
      'animal_types_sale_price_non_negative',
      sql`${t.salePrice} IS NULL OR ${t.salePrice} >= 0`,
    ),
    check(
      'animal_types_product_price_non_negative',
      sql`${t.productBasePrice} IS NULL OR ${t.productBasePrice} >= 0`,
    ),
  ],
);

// 8. game_constants
export const gameConstants = pgTable(
  'game_constants',
  {
    id: uuid('id').primaryKey().default(uuidv7()),
    gameVersionId: uuid('game_version_id')
      .notNull()
      .references(() => gameVersions.id, { onDelete: 'restrict' }),
    key: varchar('key', { length: 100 }).notNull(),
    value: jsonb('value').$type<unknown>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique('game_constants_version_key_unique').on(t.gameVersionId, t.key),
  ],
);
