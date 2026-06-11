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
 * Close the shared connection pool for graceful shutdown (server SIGTERM,
 * end of migrate/seed scripts, test teardown).
 */
export async function closeDb(): Promise<void> {
  await sql.end();
}
