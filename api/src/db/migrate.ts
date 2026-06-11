import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql, closeDb } from './client';

/**
 * Transparent SQL migrator (H2.2).
 *
 * Applies every *.sql file in ./migrations in ascending filename order, exactly
 * once, recording applied files in `schema_migrations`. Deliberately does NOT
 * depend on drizzle-kit's `_journal`: the hand-authored SQL files are the source
 * of truth applied at runtime (Docker runs `node dist/db/migrate.js`).
 *
 * Runs both via tsx (src/db/migrate.ts) and compiled (dist/db/migrate.js):
 * the `migrations` dir is resolved relative to __dirname, and the build script
 * copies the .sql files into dist/db/migrations.
 */

const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function migrate(): Promise<void> {
  // Bookkeeping table.
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const applied = await sql<{ name: string }[]>`SELECT name FROM schema_migrations`;
  const appliedNames = new Set(applied.map((row) => row.name));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.warn(`[migrate] no .sql files found in ${MIGRATIONS_DIR}`);
  }

  let appliedCount = 0;
  for (const file of files) {
    if (appliedNames.has(file)) {
      console.log(`[migrate] skip   ${file} (already applied)`);
      continue;
    }

    const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

    // Each migration runs in its own transaction; the record is written in the
    // same transaction so a failure leaves nothing applied/recorded.
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
    });

    appliedCount += 1;
    console.log(`[migrate] apply  ${file}`);
  }

  console.log(
    `[migrate] done: ${appliedCount} applied, ${files.length - appliedCount} skipped`,
  );
}

migrate()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err: unknown) => {
    console.error('[migrate] failed:', err);
    await closeDb().catch(() => undefined);
    process.exit(1);
  });
