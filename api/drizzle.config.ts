import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit configuration.
 *
 * Used for `drizzle-kit studio` and any future schema diffing. The runtime
 * migrator (src/db/migrate.ts) does NOT use drizzle-kit's journal; the source
 * of truth applied at runtime is the hand-authored SQL in src/db/migrations/.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
