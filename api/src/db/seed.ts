import { eq } from 'drizzle-orm';
import { db, closeDb } from './client';
import {
  gameVersions,
  crops,
  silageCrops,
  animalTypes,
  gameConstants,
} from './schema';
import { gameVersionsSeed } from './seeds/gameVersions';
import { cropsSeed } from './seeds/crops';
import { silageCropsSeed } from './seeds/silageCrops';
import { animalTypesSeed } from './seeds/animalTypes';
import { gameConstantsSeed } from './seeds/gameConstants';
import {
  monthlyRatesSchema,
  feedOptionsSchema,
  parseGameConstantValue,
  type GameConstantKey,
} from '../schemas/catalog';

/**
 * Idempotent catalog seeder (H2.3 + H2.4).
 *
 * Seeds the versioned game catalogs (crops, silage_crops, animal_types,
 * game_constants) for a single game_version, inside one transaction.
 *
 * Validation (the "seed fails if not valid" requirement, docs/plan H2.4):
 * every animal_types `monthly_rates` and `feed_options` block, and every
 * game_constants `value`, is validated with the zod schemas in
 * src/schemas/catalog.ts BEFORE any insert. A validation failure aborts the
 * whole transaction (nothing is written) and exits non-zero.
 *
 * Idempotency: re-running is safe. Every insert uses onConflictDoNothing keyed
 * by the documented unique constraints (game_versions.label,
 * crops(version,slug), silage_crops(version,crop), animal_types(version,
 * species), game_constants(version,key)), so a second run inserts nothing new.
 *
 * Runs via tsx (`npm run db:seed`) and compiled (`node dist/db/seed.js` in
 * Docker): relative imports, no .js extensions, CommonJS output.
 */

/** Pre-insert validation. Throws (ZodError or Error) if any block is invalid. */
function validateSeedData(): void {
  // Validate every animal_types monthly_rates + feed_options against the
  // per-species zod schemas.
  for (const animal of animalTypesSeed) {
    try {
      monthlyRatesSchema(animal.species).parse(animal.monthlyRates);
    } catch (err) {
      throw new Error(
        `Invalid monthly_rates for species "${animal.species}": ${formatErr(err)}`,
      );
    }
    try {
      feedOptionsSchema(animal.species).parse(animal.feedOptions);
    } catch (err) {
      throw new Error(
        `Invalid feed_options for species "${animal.species}": ${formatErr(err)}`,
      );
    }
  }

  // Validate every game_constants value against its keyed schema.
  for (const key of Object.keys(gameConstantsSeed) as GameConstantKey[]) {
    try {
      parseGameConstantValue(key, gameConstantsSeed[key]);
    } catch (err) {
      throw new Error(
        `Invalid game_constants value for key "${key}": ${formatErr(err)}`,
      );
    }
  }
}

function formatErr(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

interface SeedSummary {
  gameVersionId: string;
  cropsInserted: number;
  silageInserted: number;
  animalTypesInserted: number;
  gameConstantsInserted: number;
}

async function seed(): Promise<SeedSummary> {
  // 1) Validate everything up front; abort before touching the DB if invalid.
  validateSeedData();
  console.log('[seed] validation passed');

  return db.transaction(async (tx) => {
    // 2) Upsert the game_version (unique by label) and get its id back.
    const versionSeed = gameVersionsSeed[0];
    const insertedVersions = await tx
      .insert(gameVersions)
      .values({
        label: versionSeed.label,
        isActive: versionSeed.isActive,
        releasedAt: versionSeed.releasedAt,
      })
      .onConflictDoUpdate({
        target: gameVersions.label,
        set: { isActive: versionSeed.isActive, releasedAt: versionSeed.releasedAt },
      })
      .returning({ id: gameVersions.id });

    const gameVersionId = insertedVersions[0].id;
    console.log(
      `[seed] game_version "${versionSeed.label}" -> ${gameVersionId}`,
    );

    // 3) Insert crops (idempotent on (game_version_id, slug)).
    const cropRows = cropsSeed.map((c) => ({
      gameVersionId,
      slug: c.slug,
      nameEs: c.nameEs,
      nameEn: c.nameEn,
      yieldPerM2: c.yieldPerM2,
      basePrice: c.basePrice,
      maxPriceFactor: c.maxPriceFactor,
      seedRate: c.seedRate,
      weightPerLiter: c.weightPerLiter,
    }));
    const insertedCrops = await tx
      .insert(crops)
      .values(cropRows)
      .onConflictDoNothing({ target: [crops.gameVersionId, crops.slug] })
      .returning({ id: crops.id });

    // 4) Build slug -> cropId map for this version (covers both newly-inserted
    //    rows and rows already present from a previous run).
    const existingCrops = await tx
      .select({ id: crops.id, slug: crops.slug })
      .from(crops)
      .where(eq(crops.gameVersionId, gameVersionId));
    const cropIdBySlug = new Map<string, string>(
      existingCrops.map((row) => [row.slug, row.id]),
    );

    // 5) Insert silage_crops, resolving crop_id via the slug map.
    const silageRows = silageCropsSeed.map((s) => {
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
    });
    const insertedSilage = await tx
      .insert(silageCrops)
      .values(silageRows)
      .onConflictDoNothing({
        target: [silageCrops.gameVersionId, silageCrops.cropId],
      })
      .returning({ id: silageCrops.id });

    // 6) Insert animal_types (already validated above).
    const animalRows = animalTypesSeed.map((a) => ({
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
    }));
    const insertedAnimals = await tx
      .insert(animalTypes)
      .values(animalRows)
      .onConflictDoNothing({
        target: [animalTypes.gameVersionId, animalTypes.species],
      })
      .returning({ id: animalTypes.id });

    // 7) Insert game_constants as one KV row per key (value as JSONB number/obj).
    const constantRows = (
      Object.keys(gameConstantsSeed) as GameConstantKey[]
    ).map((key) => ({
      gameVersionId,
      key,
      value: gameConstantsSeed[key] as unknown,
    }));
    const insertedConstants = await tx
      .insert(gameConstants)
      .values(constantRows)
      .onConflictDoNothing({
        target: [gameConstants.gameVersionId, gameConstants.key],
      })
      .returning({ id: gameConstants.id });

    return {
      gameVersionId,
      cropsInserted: insertedCrops.length,
      silageInserted: insertedSilage.length,
      animalTypesInserted: insertedAnimals.length,
      gameConstantsInserted: insertedConstants.length,
    };
  });
}

seed()
  .then(async (summary) => {
    const allZero =
      summary.cropsInserted === 0 &&
      summary.silageInserted === 0 &&
      summary.animalTypesInserted === 0 &&
      summary.gameConstantsInserted === 0;
    console.log('[seed] summary:', {
      gameVersionId: summary.gameVersionId,
      crops: `${summary.cropsInserted}/${cropsSeed.length}`,
      silageCrops: `${summary.silageInserted}/${silageCropsSeed.length}`,
      animalTypes: `${summary.animalTypesInserted}/${animalTypesSeed.length}`,
      gameConstants: `${summary.gameConstantsInserted}/${Object.keys(gameConstantsSeed).length}`,
    });
    if (allZero) {
      console.log('[seed] already seeded (nothing inserted) — idempotent no-op');
    } else {
      console.log('[seed] done');
    }
    await closeDb();
    process.exit(0);
  })
  .catch(async (err: unknown) => {
    console.error('[seed] FAILED:', formatErr(err));
    await closeDb().catch(() => undefined);
    process.exit(1);
  });
