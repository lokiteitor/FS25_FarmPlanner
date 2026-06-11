import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';

import {
  startHarness,
  stopHarness,
  type DbHarness,
} from './helpers';
import {
  gameVersions,
  crops,
  silageCrops,
  animalTypes,
  gameConstants,
} from '../../src/db/schema';

/**
 * Seed content assertions (H2.4): counts, the single active version, and a few
 * exact catalog values copied verbatim from docs/seeds-catalogo.md.
 */

describe('DB seeds', () => {
  let harness: DbHarness;

  beforeAll(async () => {
    harness = await startHarness();
  }, 120000);

  afterAll(async () => {
    await stopHarness(harness);
  });

  describe('counts', () => {
    it('seeds 25 crops', async () => {
      const rows = await harness.db
        .select({ id: crops.id })
        .from(crops)
        .where(eq(crops.gameVersionId, harness.gameVersionId));
      expect(rows).toHaveLength(25);
    });

    it('seeds 10 silage_crops', async () => {
      const rows = await harness.db
        .select({ id: silageCrops.id })
        .from(silageCrops)
        .where(eq(silageCrops.gameVersionId, harness.gameVersionId));
      expect(rows).toHaveLength(10);
    });

    it('seeds 7 animal_types', async () => {
      const rows = await harness.db
        .select({ id: animalTypes.id })
        .from(animalTypes)
        .where(eq(animalTypes.gameVersionId, harness.gameVersionId));
      expect(rows).toHaveLength(7);
    });

    it('seeds at least 11 game_constants', async () => {
      const rows = await harness.db
        .select({ id: gameConstants.id })
        .from(gameConstants)
        .where(eq(gameConstants.gameVersionId, harness.gameVersionId));
      expect(rows.length).toBeGreaterThanOrEqual(11);
    });

    it('has exactly one active game_version', async () => {
      const active = await harness.db
        .select({ id: gameVersions.id, label: gameVersions.label })
        .from(gameVersions)
        .where(eq(gameVersions.isActive, true));
      expect(active).toHaveLength(1);
      expect(active[0].label).toBe('FS25 1.0');
    });
  });

  describe('exact catalog values', () => {
    it('poplar crop yield_per_m2 is 19.881', async () => {
      const [row] = await harness.db
        .select({ yield: crops.yieldPerM2 })
        .from(crops)
        .where(
          and(
            eq(crops.gameVersionId, harness.gameVersionId),
            eq(crops.slug, 'poplar'),
          ),
        );
      expect(row.yield).toBeCloseTo(19.881, 3);
    });

    it('poplar silage yield_per_m2 is 6.627 (its own value, not the crop yield)', async () => {
      const [poplar] = await harness.db
        .select({ id: crops.id })
        .from(crops)
        .where(
          and(
            eq(crops.gameVersionId, harness.gameVersionId),
            eq(crops.slug, 'poplar'),
          ),
        );
      const [silage] = await harness.db
        .select({ yield: silageCrops.yieldPerM2 })
        .from(silageCrops)
        .where(eq(silageCrops.cropId, poplar.id));
      expect(silage.yield).toBeCloseTo(6.627, 3);
    });

    it('cow monthly_rates.milk is 135', async () => {
      const [cow] = await harness.db
        .select({ rates: animalTypes.monthlyRates })
        .from(animalTypes)
        .where(
          and(
            eq(animalTypes.gameVersionId, harness.gameVersionId),
            eq(animalTypes.species, 'cow'),
          ),
        );
      expect(cow.rates.milk).toBe(135);
    });

    it('goat sale_price is 1000', async () => {
      const [goat] = await harness.db
        .select({ salePrice: animalTypes.salePrice })
        .from(animalTypes)
        .where(
          and(
            eq(animalTypes.gameVersionId, harness.gameVersionId),
            eq(animalTypes.species, 'goat'),
          ),
        );
      expect(goat.salePrice).toBe(1000);
    });

    it('straw_yield_per_m2 game_constant is 5.244', async () => {
      const [row] = await harness.db
        .select({ value: gameConstants.value })
        .from(gameConstants)
        .where(
          and(
            eq(gameConstants.gameVersionId, harness.gameVersionId),
            eq(gameConstants.key, 'straw_yield_per_m2'),
          ),
        );
      expect(row.value).toBe(5.244);
    });
  });
});
