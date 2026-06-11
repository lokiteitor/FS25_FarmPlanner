import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

import * as schema from '../../src/db/schema';
import {
  gameVersions,
  crops,
  silageCrops,
  animalTypes,
  gameConstants,
  users,
  farms,
} from '../../src/db/schema';
import { gameVersionsSeed } from '../../src/db/seeds/gameVersions';
import { cropsSeed } from '../../src/db/seeds/crops';
import { silageCropsSeed } from '../../src/db/seeds/silageCrops';
import { animalTypesSeed } from '../../src/db/seeds/animalTypes';
import { gameConstantsSeed } from '../../src/db/seeds/gameConstants';
import {
  monthlyRatesSchema,
  feedOptionsSchema,
  parseGameConstantValue,
  type GameConstantKey,
} from '../../src/schemas/catalog';

/**
 * Shared Testcontainers harness for the DB integration tests (H2.4).
 *
 * Spins up a real `postgres:18-alpine` container (required for native
 * `uuidv7()` and `citext`), applies the hand-authored migration SQL exactly as
 * src/db/migrate.ts would, then runs the catalog seeder. The migrate.ts and
 * seed.ts entrypoints self-execute and call process.exit, so they cannot be
 * imported here; instead we re-apply the same SQL file and replicate the seed
 * transaction against a container-scoped drizzle client.
 *
 * If Docker is unreachable, startHarness() rejects at runtime — that is the
 * expected failure mode in environments without Docker. The harness still
 * compiles and is correct.
 */

export type Sql = ReturnType<typeof postgres>;
export type Db = ReturnType<typeof drizzle<typeof schema>>;

export interface DbHarness {
  container: StartedPostgreSqlContainer;
  sql: Sql;
  db: Db;
  /** id of the single active game_version created by the seeder. */
  gameVersionId: string;
}

const MIGRATION_FILE = join(
  __dirname,
  '..',
  '..',
  'src',
  'db',
  'migrations',
  '0000_init.sql',
);

/**
 * Applies the initial migration SQL (the runtime source of truth) in one
 * transaction, mirroring src/db/migrate.ts.
 */
async function runMigrations(sql: Sql): Promise<void> {
  const content = readFileSync(MIGRATION_FILE, 'utf8');
  await sql.begin(async (tx) => {
    await tx.unsafe(content);
  });
}

/**
 * Validates and seeds the catalogs, mirroring src/db/seed.ts. Returns the
 * created game_version id.
 */
async function runSeed(db: Db): Promise<string> {
  // 1) Pre-insert validation (the "seed fails if not valid" contract, H2.4).
  for (const animal of animalTypesSeed) {
    monthlyRatesSchema(animal.species).parse(animal.monthlyRates);
    feedOptionsSchema(animal.species).parse(animal.feedOptions);
  }
  for (const key of Object.keys(gameConstantsSeed) as GameConstantKey[]) {
    parseGameConstantValue(key, gameConstantsSeed[key]);
  }

  return db.transaction(async (tx) => {
    // 2) game_version
    const versionSeed = gameVersionsSeed[0];
    const insertedVersions = await tx
      .insert(gameVersions)
      .values({
        label: versionSeed.label,
        isActive: versionSeed.isActive,
        releasedAt: versionSeed.releasedAt,
      })
      .returning({ id: gameVersions.id });
    const gameVersionId = insertedVersions[0].id;

    // 3) crops
    await tx.insert(crops).values(
      cropsSeed.map((c) => ({
        gameVersionId,
        slug: c.slug,
        nameEs: c.nameEs,
        nameEn: c.nameEn,
        yieldPerM2: c.yieldPerM2,
        basePrice: c.basePrice,
        maxPriceFactor: c.maxPriceFactor,
        seedRate: c.seedRate,
        weightPerLiter: c.weightPerLiter,
      })),
    );

    // 4) slug -> cropId map
    const existingCrops = await tx
      .select({ id: crops.id, slug: crops.slug })
      .from(crops)
      .where(eq(crops.gameVersionId, gameVersionId));
    const cropIdBySlug = new Map<string, string>(
      existingCrops.map((row) => [row.slug, row.id]),
    );

    // 5) silage_crops
    await tx.insert(silageCrops).values(
      silageCropsSeed.map((s) => {
        const cropId = cropIdBySlug.get(s.cropSlug);
        if (!cropId) {
          throw new Error(
            `silage_crops references unknown crop slug "${s.cropSlug}"`,
          );
        }
        return {
          gameVersionId,
          cropId,
          yieldPerM2: s.yieldPerM2,
          chaffFactor: s.chaffFactor,
        };
      }),
    );

    // 6) animal_types
    await tx.insert(animalTypes).values(
      animalTypesSeed.map((a) => ({
        gameVersionId,
        species: a.species,
        nameEs: a.nameEs,
        difficultyScalarEasy: a.difficultyScalars.easy,
        difficultyScalarNormal: a.difficultyScalars.normal,
        difficultyScalarHard: a.difficultyScalars.hard,
        salePrice: a.salePrice,
        productSlug: a.product?.slug ?? null,
        productBasePrice: a.product?.basePrice ?? null,
        productPriceScalar: a.product?.priceScalar ?? null,
        monthlyRates: a.monthlyRates,
        feedOptions: a.feedOptions,
      })),
    );

    // 7) game_constants
    await tx.insert(gameConstants).values(
      (Object.keys(gameConstantsSeed) as GameConstantKey[]).map((key) => ({
        gameVersionId,
        key,
        value: gameConstantsSeed[key] as unknown,
      })),
    );

    return gameVersionId;
  });
}

/**
 * Starts the container, applies migrations + seeds, and returns the harness.
 * Use with a long (120000ms) beforeAll timeout for image pull/start.
 */
export async function startHarness(): Promise<DbHarness> {
  const container = await new PostgreSqlContainer('postgres:18-alpine').start();

  const connectionUri = container.getConnectionUri();
  // Expose for any code path that reads DATABASE_URL.
  process.env.DATABASE_URL = connectionUri;

  // Container-scoped client (NOT src/db/client.ts, which binds env at import).
  const sql = postgres(connectionUri, { max: 5, onnotice: () => undefined });
  const db = drizzle(sql, { schema });

  await runMigrations(sql);
  const gameVersionId = await runSeed(db);

  return { container, sql, db, gameVersionId };
}

export async function stopHarness(harness: DbHarness | undefined): Promise<void> {
  if (!harness) {
    return;
  }
  await harness.sql.end({ timeout: 5 });
  await harness.container.stop();
}

/**
 * Creates a fresh user + farm to hang domain rows (fields/stables/machinery)
 * off. Email/name are randomized so it is safe to call many times. The farm is
 * attached to the seeded active game_version unless overridden.
 */
export async function createUserAndFarm(
  harness: DbHarness,
  overrides: { farmName?: string; userEmail?: string } = {},
): Promise<{ userId: string; farmId: string }> {
  const suffix = randomUUID().slice(0, 8);
  const email = overrides.userEmail ?? `user_${suffix}@example.com`;
  const farmName = overrides.farmName ?? `Farm ${suffix}`;

  const insertedUsers = await harness.db
    .insert(users)
    .values({
      email,
      passwordHash: 'x'.repeat(32),
      displayName: `Tester ${suffix}`,
    })
    .returning({ id: users.id });
  const userId = insertedUsers[0].id;

  const insertedFarms = await harness.db
    .insert(farms)
    .values({
      userId,
      gameVersionId: harness.gameVersionId,
      name: farmName,
    })
    .returning({ id: farms.id });
  const farmId = insertedFarms[0].id;

  return { userId, farmId };
}

/**
 * Creates only a user (no farm), used when a test needs to make two farms for
 * the same user to exercise the (user_id, name) unique constraint.
 */
export async function createUser(harness: DbHarness): Promise<string> {
  const suffix = randomUUID().slice(0, 8);
  const inserted = await harness.db
    .insert(users)
    .values({
      email: `user_${suffix}@example.com`,
      passwordHash: 'x'.repeat(32),
    })
    .returning({ id: users.id });
  return inserted[0].id;
}
