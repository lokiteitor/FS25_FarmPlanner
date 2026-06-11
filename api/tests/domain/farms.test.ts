/**
 * Farms API integration tests (H4.2).
 *
 * Runs the real /api/v1/farms CRUD against a freshly-seeded postgres:18-alpine.
 * Covers docs/openapi.yaml + docs/base-de-datos.md §9:
 *   - list paginated with fieldCount/stableCount + meta.pagination
 *   - create defaults gameVersionId to the active version
 *   - duplicate name → 409 DUPLICATE_FARM_NAME
 *   - get / patch / delete
 *   - changing gameVersionId remaps field crops by slug (with a single seeded
 *     version we assert the path works + the warnings shape, no crash)
 *   - delete cascades to nested resources
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import {
  bootstrapDomainApp,
  teardownDomainApp,
  registerUser,
  dataOf,
  errorOf,
  type DomainAppContext,
  type TestUser,
} from './_setup';

const BASE = '/api/v1/farms';

interface FarmDto {
  id: string;
  userId: string;
  gameVersionId: string;
  name: string;
  mapName: string | null;
  difficulty: string;
  defaultYieldBonus: number;
  sellPriceType: string;
  notes: string | null;
  fieldCount: number;
  stableCount: number;
  createdAt: string;
  updatedAt: string;
}

describe('Farms API (H4.2)', () => {
  let ctx: DomainAppContext;
  let user: TestUser;

  beforeAll(async () => {
    ctx = await bootstrapDomainApp();
    user = await registerUser(ctx.app, 'farms');
  }, 120000);

  afterAll(async () => {
    await teardownDomainApp(ctx);
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('GET /farms', () => {
    it('401 without a token', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: BASE });
      expect(res.statusCode).toBe(401);
    });

    it('200 lists the user farms with counters and pagination meta', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: BASE,
        headers: user.authHeader,
      });
      expect(res.statusCode).toBe(200);

      const farms = dataOf<FarmDto[]>(res.payload);
      // The default farm from registration is present.
      expect(farms.length).toBeGreaterThanOrEqual(1);
      const def = farms.find((f) => f.id === user.defaultFarmId)!;
      expect(def).toBeDefined();
      expect(def.fieldCount).toBe(0);
      expect(def.stableCount).toBe(0);
      expect(def.userId).toBe(user.id);

      const meta = (
        JSON.parse(res.payload) as {
          meta: { pagination: { page: number; perPage: number; total: number } };
        }
      ).meta;
      expect(meta.pagination.page).toBe(1);
      expect(meta.pagination.perPage).toBe(50);
      expect(meta.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it('200 honours page/perPage query', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `${BASE}?page=1&perPage=1`,
        headers: user.authHeader,
      });
      expect(res.statusCode).toBe(200);
      const meta = (
        JSON.parse(res.payload) as {
          meta: { pagination: { perPage: number } };
        }
      ).meta;
      expect(meta.pagination.perPage).toBe(1);
      expect(dataOf<FarmDto[]>(res.payload).length).toBeLessThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('POST /farms', () => {
    it('201 creates a farm defaulting gameVersionId to the active version', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: BASE,
        headers: user.authHeader,
        payload: { name: 'Riverbend Run' },
      });
      expect(res.statusCode).toBe(201);
      const farm = dataOf<FarmDto>(res.payload);
      expect(farm.name).toBe('Riverbend Run');
      expect(farm.gameVersionId).toBe(ctx.harness.gameVersionId);
      expect(farm.userId).toBe(user.id);
      // DB defaults flow through.
      expect(farm.difficulty).toBe('normal');
      expect(farm.sellPriceType).toBe('baseline');
      expect(farm.defaultYieldBonus).toBeCloseTo(0.425, 6);
      expect(farm.fieldCount).toBe(0);
      expect(farm.stableCount).toBe(0);
    });

    it('201 honours explicit optional columns', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: BASE,
        headers: user.authHeader,
        payload: {
          name: 'Zielonka Hard',
          mapName: 'Zielonka',
          difficulty: 'hard',
          sellPriceType: 'max_seasonal',
          defaultYieldBonus: 0.5,
          notes: 'tough economy',
        },
      });
      expect(res.statusCode).toBe(201);
      const farm = dataOf<FarmDto>(res.payload);
      expect(farm.mapName).toBe('Zielonka');
      expect(farm.difficulty).toBe('hard');
      expect(farm.sellPriceType).toBe('max_seasonal');
      expect(farm.defaultYieldBonus).toBeCloseTo(0.5, 6);
      expect(farm.notes).toBe('tough economy');
    });

    it('409 DUPLICATE_FARM_NAME for a name the user already has', async () => {
      const name = `Dup ${Date.now()}`;
      const first = await ctx.app.inject({
        method: 'POST',
        url: BASE,
        headers: user.authHeader,
        payload: { name },
      });
      expect(first.statusCode).toBe(201);

      const second = await ctx.app.inject({
        method: 'POST',
        url: BASE,
        headers: user.authHeader,
        payload: { name },
      });
      expect(second.statusCode).toBe(409);
      expect(errorOf(second.payload).code).toBe('DUPLICATE_FARM_NAME');
    });

    it('422 VALIDATION_ERROR on an empty name', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: BASE,
        headers: user.authHeader,
        payload: { name: '' },
      });
      expect(res.statusCode).toBe(422);
      expect(errorOf(res.payload).code).toBe('VALIDATION_ERROR');
    });

    it('422 VALIDATION_ERROR on an unknown key (strict body)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: BASE,
        headers: user.authHeader,
        payload: { name: 'With extra', surprise: true },
      });
      expect(res.statusCode).toBe(422);
      expect(errorOf(res.payload).code).toBe('VALIDATION_ERROR');
    });

    it('two different users may reuse the same farm name', async () => {
      const other = await registerUser(ctx.app, 'farms-other');
      const name = `Shared ${Date.now()}`;
      const a = await ctx.app.inject({
        method: 'POST',
        url: BASE,
        headers: user.authHeader,
        payload: { name },
      });
      const b = await ctx.app.inject({
        method: 'POST',
        url: BASE,
        headers: other.authHeader,
        payload: { name },
      });
      expect(a.statusCode).toBe(201);
      expect(b.statusCode).toBe(201);
    });
  });

  // -------------------------------------------------------------------------
  // get / patch / delete
  // -------------------------------------------------------------------------
  describe('GET/PATCH/DELETE /farms/:farmId', () => {
    async function makeFarm(name: string): Promise<FarmDto> {
      const res = await ctx.app.inject({
        method: 'POST',
        url: BASE,
        headers: user.authHeader,
        payload: { name },
      });
      expect(res.statusCode).toBe(201);
      return dataOf<FarmDto>(res.payload);
    }

    it('GET 200 returns the farm; 404 for an unknown id', async () => {
      const farm = await makeFarm(`Get ${Date.now()}`);
      const ok = await ctx.app.inject({
        method: 'GET',
        url: `${BASE}/${farm.id}`,
        headers: user.authHeader,
      });
      expect(ok.statusCode).toBe(200);
      expect(dataOf<FarmDto>(ok.payload).id).toBe(farm.id);

      const missing = await ctx.app.inject({
        method: 'GET',
        url: `${BASE}/00000000-0000-0000-0000-000000000000`,
        headers: user.authHeader,
      });
      expect(missing.statusCode).toBe(404);
      expect(errorOf(missing.payload).code).toBe('FARM_NOT_FOUND');
    });

    it('PATCH 200 updates fields; can clear nullable mapName/notes', async () => {
      const farm = await makeFarm(`Patch ${Date.now()}`);
      const res = await ctx.app.inject({
        method: 'PATCH',
        url: `${BASE}/${farm.id}`,
        headers: user.authHeader,
        payload: { difficulty: 'easy', mapName: 'Riverbend', notes: null },
      });
      expect(res.statusCode).toBe(200);
      const updated = dataOf<FarmDto>(res.payload);
      expect(updated.difficulty).toBe('easy');
      expect(updated.mapName).toBe('Riverbend');
      expect(updated.notes).toBeNull();
    });

    it('PATCH 409 DUPLICATE_FARM_NAME when renaming onto an existing name', async () => {
      const a = await makeFarm(`Rename A ${Date.now()}`);
      const b = await makeFarm(`Rename B ${Date.now()}`);
      const res = await ctx.app.inject({
        method: 'PATCH',
        url: `${BASE}/${b.id}`,
        headers: user.authHeader,
        payload: { name: a.name },
      });
      expect(res.statusCode).toBe(409);
      expect(errorOf(res.payload).code).toBe('DUPLICATE_FARM_NAME');
    });

    /**
     * Fabricate an additional (inactive) game version carrying the given crop
     * slugs, so we can drive the real change-version remap path. Returns the new
     * version id plus a slug→cropId map for that version.
     */
    async function makeVersionWithCrops(
      label: string,
      slugs: string[],
    ): Promise<{ versionId: string; cropIdBySlug: Map<string, string> }> {
      const { gameVersions, crops } = await import('../../src/db/schema/catalog');
      const [version] = await ctx.db
        .insert(gameVersions)
        .values({ label, isActive: false, releasedAt: null })
        .returning({ id: gameVersions.id });

      const cropIdBySlug = new Map<string, string>();
      if (slugs.length > 0) {
        const inserted = await ctx.db
          .insert(crops)
          .values(
            slugs.map((slug) => ({
              gameVersionId: version.id,
              slug,
              nameEs: slug,
              nameEn: slug,
              yieldPerM2: 1,
              basePrice: 1,
              maxPriceFactor: 1.1,
              seedRate: 0.01,
              weightPerLiter: 0.5,
            })),
          )
          .returning({ id: crops.id, slug: crops.slug });
        for (const row of inserted) cropIdBySlug.set(row.slug, row.id);
      }
      return { versionId: version.id, cropIdBySlug };
    }

    it('PATCH changing gameVersionId remaps a field crop by slug (slug present in target)', async () => {
      const farm = await makeFarm(`Remap keep ${Date.now()}`);
      const cropsRes = await ctx.app.inject({
        method: 'GET',
        url: '/api/v1/catalog/crops',
        headers: user.authHeader,
      });
      const wheat = dataOf<{ id: string; slug: string }[]>(
        cropsRes.payload,
      ).find((c) => c.slug === 'wheat')!;

      const fieldRes = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/${farm.id}/fields`,
        headers: user.authHeader,
        payload: { fieldNumber: 1, hectares: 5, cropId: wheat.id },
      });
      expect(fieldRes.statusCode).toBe(201);

      // Target version DOES carry 'wheat', so the field crop is remapped to the
      // target's wheat id and there is no warning.
      const target = await makeVersionWithCrops(`TGT-keep ${Date.now()}`, [
        'wheat',
      ]);
      const patch = await ctx.app.inject({
        method: 'PATCH',
        url: `${BASE}/${farm.id}`,
        headers: user.authHeader,
        payload: { gameVersionId: target.versionId },
      });
      expect(patch.statusCode).toBe(200);
      const body = JSON.parse(patch.payload) as {
        data: FarmDto;
        meta?: { warnings?: string[] };
      };
      expect(body.data.gameVersionId).toBe(target.versionId);
      expect(body.data.fieldCount).toBe(1);
      if (body.meta?.warnings) {
        expect(Array.isArray(body.meta.warnings)).toBe(true);
        expect(body.meta.warnings).toHaveLength(0);
      }

      // The field crop now points at the TARGET version's wheat row (remapped by
      // slug), not the original crop id.
      const after = await ctx.app.inject({
        method: 'GET',
        url: `${BASE}/${farm.id}/fields`,
        headers: user.authHeader,
      });
      const fields = dataOf<{ cropId: string | null }[]>(after.payload);
      expect(fields[0].cropId).toBe(target.cropIdBySlug.get('wheat'));
    });

    it('PATCH changing gameVersionId clears a crop missing in the target (meta.warnings)', async () => {
      const farm = await makeFarm(`Remap drop ${Date.now()}`);
      const cropsRes = await ctx.app.inject({
        method: 'GET',
        url: '/api/v1/catalog/crops',
        headers: user.authHeader,
      });
      const wheat = dataOf<{ id: string; slug: string }[]>(
        cropsRes.payload,
      ).find((c) => c.slug === 'wheat')!;

      const fieldRes = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/${farm.id}/fields`,
        headers: user.authHeader,
        payload: { fieldNumber: 1, hectares: 5, cropId: wheat.id },
      });
      expect(fieldRes.statusCode).toBe(201);

      // Target version does NOT carry 'wheat' (only 'corn'), so the field crop is
      // cleared to null and a warning is reported.
      const target = await makeVersionWithCrops(`TGT-drop ${Date.now()}`, [
        'corn',
      ]);
      const patch = await ctx.app.inject({
        method: 'PATCH',
        url: `${BASE}/${farm.id}`,
        headers: user.authHeader,
        payload: { gameVersionId: target.versionId },
      });
      expect(patch.statusCode).toBe(200);
      const body = JSON.parse(patch.payload) as {
        data: FarmDto;
        meta?: { warnings?: string[] };
      };
      expect(body.data.gameVersionId).toBe(target.versionId);
      expect(body.meta?.warnings).toBeDefined();
      expect(body.meta!.warnings!.length).toBeGreaterThan(0);

      const after = await ctx.app.inject({
        method: 'GET',
        url: `${BASE}/${farm.id}/fields`,
        headers: user.authHeader,
      });
      const fields = dataOf<{ cropId: string | null }[]>(after.payload);
      expect(fields[0].cropId).toBeNull();
    });

    it('DELETE 204 then 404; cascades to nested rows', async () => {
      const farm = await makeFarm(`Del ${Date.now()}`);
      // Hang a field, a stable and a machine off the farm.
      await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/${farm.id}/fields`,
        headers: user.authHeader,
        payload: { fieldNumber: 7, hectares: 3 },
      });
      const stableRes = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/${farm.id}/stables`,
        headers: user.authHeader,
        payload: { name: 'Barn', species: 'cow', maxCapacity: 10 },
      });
      const machineRes = await ctx.app.inject({
        method: 'POST',
        url: `${BASE}/${farm.id}/machinery`,
        headers: user.authHeader,
        payload: { name: 'Tractor', workingWidthM: 6, workingSpeedKmh: 12 },
      });
      const stableId = dataOf<{ id: string }>(stableRes.payload).id;
      const machineId = dataOf<{ id: string }>(machineRes.payload).id;

      const del = await ctx.app.inject({
        method: 'DELETE',
        url: `${BASE}/${farm.id}`,
        headers: user.authHeader,
      });
      expect(del.statusCode).toBe(204);

      const again = await ctx.app.inject({
        method: 'DELETE',
        url: `${BASE}/${farm.id}`,
        headers: user.authHeader,
      });
      expect(again.statusCode).toBe(404);
      expect(errorOf(again.payload).code).toBe('FARM_NOT_FOUND');

      // Cascade: the nested rows are physically gone (checked at the DB level so
      // we don't rely on the now-404 farm-scope path).
      const { fields, stables, machinery } = await import(
        '../../src/db/schema/domain'
      );
      const remainingStables = await ctx.db
        .select()
        .from(stables)
        .where(eq(stables.id, stableId));
      const remainingMachines = await ctx.db
        .select()
        .from(machinery)
        .where(eq(machinery.id, machineId));
      const remainingFields = await ctx.db
        .select()
        .from(fields)
        .where(eq(fields.farmId, farm.id));
      expect(remainingStables).toHaveLength(0);
      expect(remainingMachines).toHaveLength(0);
      expect(remainingFields).toHaveLength(0);
    });
  });
});
