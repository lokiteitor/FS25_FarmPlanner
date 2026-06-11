import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  unique,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { citext, inet, uuidv7 } from './types';

/**
 * Módulo: Identidad y Acceso — users, refresh_tokens, user_settings.
 */

// 1. users
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(uuidv7()),
    email: citext('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: varchar('display_name', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique('users_email_unique').on(t.email),
    check(
      'users_email_format',
      sql`${t.email} ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'`,
    ),
  ],
);

// 2. refresh_tokens
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().default(uuidv7()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    // Self-reference: the token that replaced this one in the rotation chain.
    replacedById: uuid('replaced_by_id').references(
      (): AnyPgColumn => refreshTokens.id,
    ),
    userAgent: text('user_agent'),
    ip: inet('ip'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('refresh_tokens_token_hash_unique').on(t.tokenHash),
    index('idx_refresh_tokens_user_id').on(t.userId),
    index('idx_refresh_tokens_expires_at').on(t.expiresAt),
  ],
);

// 3. user_settings (1:1 with users; PK = user_id, no uuidv7 default)
export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  locale: varchar('locale', { length: 10 }).notNull().default('es'),
  theme: varchar('theme', { length: 20 }).notNull().default('system'),
  // FK active_farm_id -> farms(id) ON DELETE SET NULL is declared in the SQL
  // migration (0000_init.sql) to avoid a circular import between identity.ts
  // and domain.ts. The column type/nullability here matches the doc exactly.
  activeFarmId: uuid('active_farm_id'),
  preferences: jsonb('preferences')
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
});
