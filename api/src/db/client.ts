import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '../config/env';
import * as schema from './schema';

/**
 * Shared database client.
 *
 * A single postgres-js connection pool is created from `DATABASE_URL` and
 * reused across the process. The same raw `sql` client is exported for the
 * hand-authored migrator (src/db/migrate.ts), which needs to run raw SQL files
 * and manage its own transactions.
 */

// Raw postgres-js client (connection pool). Used by Drizzle and the migrator.
export const sql = postgres(env.DATABASE_URL, {
  max: 10,
});

// Drizzle instance with the full schema for query typing.
export const db = drizzle(sql, { schema });

export type Database = typeof db;

/**
 * The transaction handle Drizzle passes to the `db.transaction(tx => ...)`
 * callback. Derived from the real signature so it stays correct if the schema
 * generics change.
 */
export type DbTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

/**
 * Anything that can run queries: the root `db` or a transaction handle.
 *
 * Repositories accept this (defaulting to `db`) so they can be composed inside a
 * single `db.transaction(...)` — e.g. the register flow that creates the user,
 * its user_settings row and a default farm atomically. Outside a transaction,
 * callers just omit the argument.
 */
export type DbExecutor = Database | DbTransaction;

/**
 * Close the shared connection pool for graceful shutdown (server SIGTERM,
 * end of migrate/seed scripts, test teardown).
 */
export async function closeDb(): Promise<void> {
  await sql.end();
}
