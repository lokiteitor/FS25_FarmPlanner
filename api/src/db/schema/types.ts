import { customType } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Custom column helpers and shared defaults.
 *
 * `drizzle-orm` pg-core has no native builders for `citext` or `inet`, so we
 * declare them here. Both map to a TS `string`; PostgreSQL handles the
 * case-insensitive comparison (citext) and the address parsing (inet).
 */

/**
 * `citext` — case-insensitive text. Used for emails. Requires the `citext`
 * extension (created in the initial migration).
 */
export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'citext';
  },
});

/**
 * `inet` — PostgreSQL network address type. Stored/read as a string.
 */
export const inet = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'inet';
  },
});

/**
 * Shared default for primary keys: PostgreSQL 18 native `uuidv7()` (ADR-008).
 * Used as `uuid('id').primaryKey().default(uuidv7())`.
 */
export const uuidv7 = () => sql`uuidv7()`;

/**
 * `numeric(precision, scale)` mapped to a TS `number`.
 *
 * drizzle-orm 0.36.x's built-in `numeric()` only maps to `string` (no
 * `{ mode: 'number' }` option — that arrived in a later release). We need a
 * number-typed numeric so DB values line up with the OpenAPI `number` types and
 * the JS calc engine (ADR-002). This custom type emits the correct SQL DDL
 * (`numeric(p,s)`) and parses to/from `number` at the driver boundary.
 *
 * Note: numeric precision beyond IEEE-754 doubles can lose digits; acceptable
 * for game projections (tolerance-based tests per ADR — see base-de-datos.md).
 */
export const numeric = (
  name: string,
  config: { precision: number; scale: number; mode: 'number' },
) =>
  customType<{ data: number; driverData: string }>({
    dataType() {
      return `numeric(${config.precision}, ${config.scale})`;
    },
    fromDriver(value: string): number {
      return Number(value);
    },
    toDriver(value: number): string {
      return String(value);
    },
  })(name);
