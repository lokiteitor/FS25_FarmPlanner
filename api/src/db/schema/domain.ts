import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  smallint,
  boolean,
  jsonb,
  timestamp,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { uuidv7, numeric } from './types';
import { difficultyEnum, sellPriceTypeEnum, animalSpeciesEnum } from './enums';
import { users } from './identity';
import { gameVersions, crops } from './catalog';

/**
 * Módulo: Dominio de Partida — farms, fields, stables, machinery,
 * animal_calculator_configs, calculator_states.
 *
 * All numeric columns use { mode: 'number' } to align with the calc engine.
 */

// 9. farms
export const farms = pgTable(
  'farms',
  {
    id: uuid('id').primaryKey().default(uuidv7()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameVersionId: uuid('game_version_id')
      .notNull()
      .references(() => gameVersions.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 100 }).notNull(),
    mapName: varchar('map_name', { length: 100 }),
    difficulty: difficultyEnum('difficulty').notNull().default('normal'),
    defaultYieldBonus: numeric('default_yield_bonus', {
      precision: 6,
      scale: 4,
      mode: 'number',
    })
      .notNull()
      .default(0.425),
    sellPriceType: sellPriceTypeEnum('sell_price_type')
      .notNull()
      .default('baseline'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique('farms_user_name_unique').on(t.userId, t.name),
    index('idx_farms_user_id').on(t.userId),
    check(
      'farms_yield_bonus_range',
      sql`${t.defaultYieldBonus} >= 0 AND ${t.defaultYieldBonus} <= 5`,
    ),
  ],
);

// 10. fields
export const fields = pgTable(
  'fields',
  {
    id: uuid('id').primaryKey().default(uuidv7()),
    farmId: uuid('farm_id')
      .notNull()
      .references(() => farms.id, { onDelete: 'cascade' }),
    fieldNumber: integer('field_number').notNull(),
    hectares: numeric('hectares', {
      precision: 8,
      scale: 2,
      mode: 'number',
    }).notNull(),
    cropId: uuid('crop_id').references(() => crops.id, {
      onDelete: 'set null',
    }),
    isSilage: boolean('is_silage').notNull().default(false),
    yieldBonus: numeric('yield_bonus', {
      precision: 6,
      scale: 4,
      mode: 'number',
    }),
    purchasePrice: numeric('purchase_price', {
      precision: 12,
      scale: 2,
      mode: 'number',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique('fields_farm_number_unique').on(t.farmId, t.fieldNumber),
    index('idx_fields_farm_id').on(t.farmId),
    index('idx_fields_crop_id').on(t.cropId),
    check('fields_number_positive', sql`${t.fieldNumber} > 0`),
    check('fields_hectares_positive', sql`${t.hectares} > 0`),
    check(
      'fields_yield_bonus_range',
      sql`${t.yieldBonus} IS NULL OR (${t.yieldBonus} >= 0 AND ${t.yieldBonus} <= 5)`,
    ),
    check(
      'fields_price_non_negative',
      sql`${t.purchasePrice} IS NULL OR ${t.purchasePrice} >= 0`,
    ),
  ],
);

// 11. stables
export const stables = pgTable(
  'stables',
  {
    id: uuid('id').primaryKey().default(uuidv7()),
    farmId: uuid('farm_id')
      .notNull()
      .references(() => farms.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    species: animalSpeciesEnum('species').notNull(),
    maxCapacity: integer('max_capacity').notNull(),
    currentCount: integer('current_count').notNull().default(0),
    config: jsonb('config')
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
    unique('stables_farm_name_unique').on(t.farmId, t.name),
    index('idx_stables_farm_id').on(t.farmId),
    check('stables_capacity_positive', sql`${t.maxCapacity} > 0`),
    check('stables_count_non_negative', sql`${t.currentCount} >= 0`),
    check(
      'stables_count_within_capacity',
      sql`${t.currentCount} <= ${t.maxCapacity}`,
    ),
  ],
);

// 12. machinery
export const machinery = pgTable(
  'machinery',
  {
    id: uuid('id').primaryKey().default(uuidv7()),
    farmId: uuid('farm_id')
      .notNull()
      .references(() => farms.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    workingWidthM: numeric('working_width_m', {
      precision: 6,
      scale: 2,
      mode: 'number',
    }).notNull(),
    workingSpeedKmh: numeric('working_speed_kmh', {
      precision: 6,
      scale: 2,
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
    index('idx_machinery_farm_id').on(t.farmId),
    check('machinery_width_positive', sql`${t.workingWidthM} > 0`),
    check('machinery_speed_positive', sql`${t.workingSpeedKmh} > 0`),
  ],
);

// 13. animal_calculator_configs
export const animalCalculatorConfigs = pgTable(
  'animal_calculator_configs',
  {
    id: uuid('id').primaryKey().default(uuidv7()),
    farmId: uuid('farm_id')
      .notNull()
      .references(() => farms.id, { onDelete: 'cascade' }),
    species: animalSpeciesEnum('species').notNull(),
    schemaVersion: smallint('schema_version').notNull().default(1),
    inputs: jsonb('inputs').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique('animal_configs_farm_species_unique').on(t.farmId, t.species),
  ],
);

// 14. calculator_states
export const calculatorStates = pgTable(
  'calculator_states',
  {
    id: uuid('id').primaryKey().default(uuidv7()),
    farmId: uuid('farm_id')
      .notNull()
      .references(() => farms.id, { onDelete: 'cascade' }),
    toolKey: varchar('tool_key', { length: 50 }).notNull(),
    state: jsonb('state')
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
    unique('calculator_states_farm_tool_unique').on(t.farmId, t.toolKey),
  ],
);
