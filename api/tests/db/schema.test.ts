import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';

import {
  startHarness,
  stopHarness,
  createUser,
  createUserAndFarm,
  type DbHarness,
} from './helpers';
import {
  gameVersions,
  crops,
  farms,
  fields,
  stables,
  machinery,
} from '../../src/db/schema';

/**
 * Schema constraint assertions (H2.4) against a real Postgres: CHECK, UNIQUE,
 * partial unique, ON DELETE CASCADE and ON DELETE SET NULL.
 *
 * Constraint-violation inserts go through the raw postgres-js client so the
 * thrown error is the DB error itself; relational reads use drizzle.
 */

describe('DB schema constraints', () => {
  let harness: DbHarness;

  beforeAll(async () => {
    harness = await startHarness();
  }, 120000);

  afterAll(async () => {
    await stopHarness(harness);
  });

  describe('CHECK constraints', () => {
    it('rejects a stable with current_count > max_capacity', async () => {
      const { farmId } = await createUserAndFarm(harness);
      await expect(
        harness.sql`
          INSERT INTO stables (farm_id, name, species, max_capacity, current_count)
          VALUES (${farmId}, 'Over Capacity Barn', 'cow', 10, 11)
        `,
      ).rejects.toThrow(/stables_count_within_capacity/);
    });

    it('accepts a stable with current_count == max_capacity', async () => {
      const { farmId } = await createUserAndFarm(harness);
      const inserted = await harness.db
        .insert(stables)
        .values({
          farmId,
          name: 'Full Barn',
          species: 'cow',
          maxCapacity: 10,
          currentCount: 10,
        })
        .returning({ id: stables.id });
      expect(inserted).toHaveLength(1);
    });
  });

  describe('UNIQUE constraints', () => {
    it('rejects two fields with the same (farm_id, field_number)', async () => {
      const { farmId } = await createUserAndFarm(harness);
      await harness.sql`
        INSERT INTO fields (farm_id, field_number, hectares)
        VALUES (${farmId}, 1, 5.00)
      `;
      await expect(
        harness.sql`
          INSERT INTO fields (farm_id, field_number, hectares)
          VALUES (${farmId}, 1, 9.00)
        `,
      ).rejects.toThrow(/fields_farm_number_unique/);
    });

    it('rejects two farms for the same (user_id, name)', async () => {
      const userId = await createUser(harness);
      await harness.sql`
        INSERT INTO farms (user_id, game_version_id, name)
        VALUES (${userId}, ${harness.gameVersionId}, 'Duplicate Name')
      `;
      await expect(
        harness.sql`
          INSERT INTO farms (user_id, game_version_id, name)
          VALUES (${userId}, ${harness.gameVersionId}, 'Duplicate Name')
        `,
      ).rejects.toThrow(/farms_user_name_unique/);
    });
  });

  describe('partial unique index', () => {
    it('rejects a second active game_version', async () => {
      // The seeded version is already active, so any second active row violates
      // the one_active_game_version partial unique index.
      await expect(
        harness.sql`
          INSERT INTO game_versions (label, is_active)
          VALUES ('FS25 2.0 active', true)
        `,
      ).rejects.toThrow(/one_active_game_version/);
    });

    it('allows additional inactive game_versions', async () => {
      const inserted = await harness.db
        .insert(gameVersions)
        .values({ label: 'FS25 2.0 inactive', isActive: false })
        .returning({ id: gameVersions.id });
      expect(inserted).toHaveLength(1);
    });
  });

  describe('ON DELETE CASCADE', () => {
    it('deleting a farm deletes its fields, stables and machinery', async () => {
      const { farmId } = await createUserAndFarm(harness);

      await harness.db
        .insert(fields)
        .values({ farmId, fieldNumber: 1, hectares: 12.5 });
      await harness.db.insert(stables).values({
        farmId,
        name: 'Cascade Barn',
        species: 'sheep',
        maxCapacity: 50,
        currentCount: 10,
      });
      await harness.db.insert(machinery).values({
        farmId,
        name: 'Harvester',
        workingWidthM: 9,
        workingSpeedKmh: 10,
      });

      // Sanity: children exist before the delete.
      expect(
        await harness.db
          .select({ id: fields.id })
          .from(fields)
          .where(eq(fields.farmId, farmId)),
      ).toHaveLength(1);

      await harness.db.delete(farms).where(eq(farms.id, farmId));

      expect(
        await harness.db
          .select({ id: fields.id })
          .from(fields)
          .where(eq(fields.farmId, farmId)),
      ).toHaveLength(0);
      expect(
        await harness.db
          .select({ id: stables.id })
          .from(stables)
          .where(eq(stables.farmId, farmId)),
      ).toHaveLength(0);
      expect(
        await harness.db
          .select({ id: machinery.id })
          .from(machinery)
          .where(eq(machinery.farmId, farmId)),
      ).toHaveLength(0);
    });
  });

  describe('ON DELETE SET NULL', () => {
    it('deleting a crop sets fields.crop_id to NULL (and keeps the field)', async () => {
      const { farmId } = await createUserAndFarm(harness);

      // Make a deletable crop on the seeded version so removing it does not
      // disturb the seeded catalog used by other tests.
      const [crop] = await harness.db
        .insert(crops)
        .values({
          gameVersionId: harness.gameVersionId,
          slug: `setnull_${Date.now()}`,
          nameEs: 'Prueba',
          nameEn: 'Test Crop',
          yieldPerM2: 1,
          basePrice: 1,
          maxPriceFactor: 1,
          seedRate: 0,
          weightPerLiter: 1,
        })
        .returning({ id: crops.id });

      const [field] = await harness.db
        .insert(fields)
        .values({
          farmId,
          fieldNumber: 7,
          hectares: 4.0,
          cropId: crop.id,
        })
        .returning({ id: fields.id });

      await harness.db.delete(crops).where(eq(crops.id, crop.id));

      const [after] = await harness.db
        .select({ id: fields.id, cropId: fields.cropId })
        .from(fields)
        .where(eq(fields.id, field.id));
      expect(after).toBeDefined();
      expect(after.cropId).toBeNull();
    });
  });

  describe('seeded catalog is queryable via drizzle', () => {
    it('finds the wheat crop on the active version', async () => {
      const [activeVersion] = await harness.db
        .select({ id: gameVersions.id })
        .from(gameVersions)
        .where(eq(gameVersions.isActive, true));

      const [wheat] = await harness.db
        .select({ slug: crops.slug, nameEn: crops.nameEn })
        .from(crops)
        .where(
          and(
            eq(crops.gameVersionId, activeVersion.id),
            eq(crops.slug, 'wheat'),
          ),
        );
      expect(wheat.nameEn).toBe('Wheat');
    });
  });
});
