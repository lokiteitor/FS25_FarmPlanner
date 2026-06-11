/**
 * Stables + Machinery API integration tests (H4.4).
 *
 * Runs the real /api/v1/farms/:farmId/{stables,machinery} routes against a
 * freshly-seeded postgres:18-alpine. Covers docs/openapi.yaml + the stable
 * business rules from docs/base-de-datos.md §11/§12:
 *   - stables: create a cow stable; currentCount > maxCapacity →
 *     422 COUNT_EXCEEDS_CAPACITY; duplicate name → 409 DUPLICATE_STABLE_NAME;
 *     config validated by species (bad feedType rejected)
 *   - machinery: create (no uniqueness), update, delete
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  bootstrapDomainApp,
  teardownDomainApp,
  registerUser,
  dataOf,
  errorOf,
  type DomainAppContext,
  type TestUser,
} from './_setup';

interface StableDto {
  id: string;
  farmId: string;
  name: string;
  species: string;
  maxCapacity: number;
  currentCount: number;
  config: Record<string, unknown>;
}

interface MachineDto {
  id: string;
  farmId: string;
  name: string;
  workingWidthM: number;
  workingSpeedKmh: number;
}

describe('Stables + Machinery API (H4.4)', () => {
  let ctx: DomainAppContext;
  let user: TestUser;
  let farmId: string;

  function stablesUrl(): string {
    return `/api/v1/farms/${farmId}/stables`;
  }
  function machineryUrl(): string {
    return `/api/v1/farms/${farmId}/machinery`;
  }

  beforeAll(async () => {
    ctx = await bootstrapDomainApp();
    user = await registerUser(ctx.app, 'stables');
    farmId = user.defaultFarmId;
  }, 120000);

  afterAll(async () => {
    await teardownDomainApp(ctx);
  });

  // =========================================================================
  // Stables
  // =========================================================================
  describe('Stables', () => {
    it('201 creates a cow stable with a valid species config', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: stablesUrl(),
        headers: user.authHeader,
        payload: {
          name: 'Dairy Barn',
          species: 'cow',
          maxCapacity: 50,
          currentCount: 30,
          config: { feedType: 'tmr', provideStraw: true },
        },
      });
      expect(res.statusCode).toBe(201);
      const stable = dataOf<StableDto>(res.payload);
      expect(stable.name).toBe('Dairy Barn');
      expect(stable.species).toBe('cow');
      expect(stable.maxCapacity).toBe(50);
      expect(stable.currentCount).toBe(30);
      expect(stable.config).toMatchObject({ feedType: 'tmr', provideStraw: true });
      expect(stable.farmId).toBe(farmId);
    });

    it('201 defaults currentCount to 0 when omitted', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: stablesUrl(),
        headers: user.authHeader,
        payload: { name: 'Empty Pen', species: 'sheep', maxCapacity: 10 },
      });
      expect(res.statusCode).toBe(201);
      expect(dataOf<StableDto>(res.payload).currentCount).toBe(0);
    });

    it('422 COUNT_EXCEEDS_CAPACITY when currentCount > maxCapacity', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: stablesUrl(),
        headers: user.authHeader,
        payload: {
          name: 'Overfull',
          species: 'cow',
          maxCapacity: 10,
          currentCount: 20,
        },
      });
      expect(res.statusCode).toBe(422);
      expect(errorOf(res.payload).code).toBe('COUNT_EXCEEDS_CAPACITY');
    });

    it('409 DUPLICATE_STABLE_NAME for a repeated name in the same farm', async () => {
      const name = `Twin Barn ${Date.now()}`;
      const first = await ctx.app.inject({
        method: 'POST',
        url: stablesUrl(),
        headers: user.authHeader,
        payload: { name, species: 'cow', maxCapacity: 5 },
      });
      expect(first.statusCode).toBe(201);
      const second = await ctx.app.inject({
        method: 'POST',
        url: stablesUrl(),
        headers: user.authHeader,
        payload: { name, species: 'pig', maxCapacity: 5 },
      });
      expect(second.statusCode).toBe(409);
      expect(errorOf(second.payload).code).toBe('DUPLICATE_STABLE_NAME');
    });

    it('422 VALIDATION_ERROR when config has a feedType invalid for the species', async () => {
      // buffalo does NOT support feedType "simple" (cow only).
      const res = await ctx.app.inject({
        method: 'POST',
        url: stablesUrl(),
        headers: user.authHeader,
        payload: {
          name: 'Buffalo Barn',
          species: 'buffalo',
          maxCapacity: 8,
          config: { feedType: 'simple' },
        },
      });
      expect(res.statusCode).toBe(422);
      expect(errorOf(res.payload).code).toBe('VALIDATION_ERROR');
    });

    it('422 VALIDATION_ERROR when config carries a key foreign to the species', async () => {
      // chicken accepts no config overrides at all (strict {}).
      const res = await ctx.app.inject({
        method: 'POST',
        url: stablesUrl(),
        headers: user.authHeader,
        payload: {
          name: 'Coop',
          species: 'chicken',
          maxCapacity: 100,
          config: { feedType: 'tmr' },
        },
      });
      expect(res.statusCode).toBe(422);
      expect(errorOf(res.payload).code).toBe('VALIDATION_ERROR');
    });

    it('GET/PATCH/DELETE lifecycle', async () => {
      const created = await ctx.app.inject({
        method: 'POST',
        url: stablesUrl(),
        headers: user.authHeader,
        payload: { name: `Life ${Date.now()}`, species: 'cow', maxCapacity: 40 },
      });
      const stableId = dataOf<StableDto>(created.payload).id;

      const get = await ctx.app.inject({
        method: 'GET',
        url: `${stablesUrl()}/${stableId}`,
        headers: user.authHeader,
      });
      expect(get.statusCode).toBe(200);

      const patch = await ctx.app.inject({
        method: 'PATCH',
        url: `${stablesUrl()}/${stableId}`,
        headers: user.authHeader,
        payload: { currentCount: 25 },
      });
      expect(patch.statusCode).toBe(200);
      expect(dataOf<StableDto>(patch.payload).currentCount).toBe(25);

      const del = await ctx.app.inject({
        method: 'DELETE',
        url: `${stablesUrl()}/${stableId}`,
        headers: user.authHeader,
      });
      expect(del.statusCode).toBe(204);

      const again = await ctx.app.inject({
        method: 'GET',
        url: `${stablesUrl()}/${stableId}`,
        headers: user.authHeader,
      });
      expect(again.statusCode).toBe(404);
      expect(errorOf(again.payload).code).toBe('STABLE_NOT_FOUND');
    });
  });

  // =========================================================================
  // Machinery
  // =========================================================================
  describe('Machinery', () => {
    it('201 creates equipment (no name uniqueness — duplicates allowed)', async () => {
      const payload = {
        name: 'JD 8R + Seeder 9m',
        workingWidthM: 9,
        workingSpeedKmh: 12,
      };
      const a = await ctx.app.inject({
        method: 'POST',
        url: machineryUrl(),
        headers: user.authHeader,
        payload,
      });
      const b = await ctx.app.inject({
        method: 'POST',
        url: machineryUrl(),
        headers: user.authHeader,
        payload,
      });
      expect(a.statusCode).toBe(201);
      expect(b.statusCode).toBe(201);
      const ma = dataOf<MachineDto>(a.payload);
      const mb = dataOf<MachineDto>(b.payload);
      // Same name, distinct rows — duplicates are intentional.
      expect(ma.name).toBe(mb.name);
      expect(ma.id).not.toBe(mb.id);
      expect(ma.workingWidthM).toBe(9);
      expect(ma.workingSpeedKmh).toBe(12);
    });

    it('PATCH 200 updates equipment', async () => {
      const created = await ctx.app.inject({
        method: 'POST',
        url: machineryUrl(),
        headers: user.authHeader,
        payload: { name: 'Old', workingWidthM: 3, workingSpeedKmh: 8 },
      });
      const id = dataOf<MachineDto>(created.payload).id;

      const patch = await ctx.app.inject({
        method: 'PATCH',
        url: `${machineryUrl()}/${id}`,
        headers: user.authHeader,
        payload: { name: 'New', workingSpeedKmh: 15 },
      });
      expect(patch.statusCode).toBe(200);
      const updated = dataOf<MachineDto>(patch.payload);
      expect(updated.name).toBe('New');
      expect(updated.workingSpeedKmh).toBe(15);
      expect(updated.workingWidthM).toBe(3);
    });

    it('DELETE 204 then 404', async () => {
      const created = await ctx.app.inject({
        method: 'POST',
        url: machineryUrl(),
        headers: user.authHeader,
        payload: { name: 'Doomed', workingWidthM: 4, workingSpeedKmh: 10 },
      });
      const id = dataOf<MachineDto>(created.payload).id;

      const del = await ctx.app.inject({
        method: 'DELETE',
        url: `${machineryUrl()}/${id}`,
        headers: user.authHeader,
      });
      expect(del.statusCode).toBe(204);

      const again = await ctx.app.inject({
        method: 'DELETE',
        url: `${machineryUrl()}/${id}`,
        headers: user.authHeader,
      });
      expect(again.statusCode).toBe(404);
      expect(errorOf(again.payload).code).toBe('MACHINE_NOT_FOUND');
    });

    it('422 VALIDATION_ERROR on a non-positive working width', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: machineryUrl(),
        headers: user.authHeader,
        payload: { name: 'Bad', workingWidthM: 0, workingSpeedKmh: 10 },
      });
      expect(res.statusCode).toBe(422);
      expect(errorOf(res.payload).code).toBe('VALIDATION_ERROR');
    });
  });
});
