/**
 * Cross-user ownership integration tests (H4.6 — critical).
 *
 * The single most important security property of this API (ADR-005,
 * docs/autorizacion-api.md): a user must never reach another user's resources.
 * Accessing a farm — or any resource nested under it — that belongs to someone
 * else is INDISTINGUISHABLE from a non-existent one: the API answers 404, never
 * 403 and never 200.
 *
 * User A creates a farm with a field, a stable, a machine, an animal-config and
 * a calculator-state. User B then probes every GET/PATCH/DELETE on A's farm and
 * each nested resource (by A's real ids). Every probe must be 404.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  bootstrapDomainApp,
  teardownDomainApp,
  registerUser,
  dataOf,
  type DomainAppContext,
  type TestUser,
} from './_setup';

interface Ids {
  farmId: string;
  fieldId: string;
  stableId: string;
  machineId: string;
}

describe('Cross-user ownership (H4.6 — never 403, never 200, always 404)', () => {
  let ctx: DomainAppContext;
  let userA: TestUser;
  let userB: TestUser;
  let a: Ids;

  beforeAll(async () => {
    ctx = await bootstrapDomainApp();
    userA = await registerUser(ctx.app, 'ownerA');
    userB = await registerUser(ctx.app, 'attackerB');

    // A creates a dedicated farm + the full nest of resources.
    const farmRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/farms',
      headers: userA.authHeader,
      payload: { name: `A's farm ${Date.now()}` },
    });
    const farmId = dataOf<{ id: string }>(farmRes.payload).id;

    const fieldRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/farms/${farmId}/fields`,
      headers: userA.authHeader,
      payload: { fieldNumber: 1, hectares: 10 },
    });
    const stableRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/farms/${farmId}/stables`,
      headers: userA.authHeader,
      payload: { name: 'A Barn', species: 'cow', maxCapacity: 20 },
    });
    const machineRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/farms/${farmId}/machinery`,
      headers: userA.authHeader,
      payload: { name: 'A Tractor', workingWidthM: 5, workingSpeedKmh: 10 },
    });
    await ctx.app.inject({
      method: 'PUT',
      url: `/api/v1/farms/${farmId}/animal-configs/cow`,
      headers: userA.authHeader,
      payload: { species: 'cow', count: 5 },
    });
    await ctx.app.inject({
      method: 'PUT',
      url: `/api/v1/farms/${farmId}/calculator-states/work_speed`,
      headers: userA.authHeader,
      payload: { efficiency: 0.8, activeMachineryIds: [] },
    });

    a = {
      farmId,
      fieldId: dataOf<{ id: string }>(fieldRes.payload).id,
      stableId: dataOf<{ id: string }>(stableRes.payload).id,
      machineId: dataOf<{ id: string }>(machineRes.payload).id,
    };

    // Sanity: A really can see its own farm (so a later 404 for B is meaningful).
    const ownGet = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/farms/${farmId}`,
      headers: userA.authHeader,
    });
    expect(ownGet.statusCode).toBe(200);
  }, 120000);

  afterAll(async () => {
    await teardownDomainApp(ctx);
  });

  /** Assert a probe is exactly 404 (the ownership 404, not 403/200). */
  async function expect404(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
    url: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    const res = await ctx.app.inject({
      method,
      url,
      headers: userB.authHeader,
      payload,
    });
    expect(
      res.statusCode,
      `${method} ${url} should be 404 for the non-owner (got ${res.statusCode}: ${res.payload})`,
    ).toBe(404);
    expect(res.statusCode).not.toBe(403);
    expect(res.statusCode).not.toBe(200);
  }

  // -------------------------------------------------------------------------
  // Farm root
  // -------------------------------------------------------------------------
  describe("on A's farm (root)", () => {
    it('GET → 404', () => expect404('GET', `/api/v1/farms/${a.farmId}`));
    it('PATCH → 404', () =>
      expect404('PATCH', `/api/v1/farms/${a.farmId}`, { name: 'hijacked' }));
    it('DELETE → 404', () => expect404('DELETE', `/api/v1/farms/${a.farmId}`));

    it("B's farm list never includes A's farm", async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/v1/farms',
        headers: userB.authHeader,
      });
      expect(res.statusCode).toBe(200);
      const farms = dataOf<{ id: string }[]>(res.payload);
      expect(farms.some((f) => f.id === a.farmId)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Nested: fields
  // -------------------------------------------------------------------------
  describe("on A's fields", () => {
    it('LIST under A farm → 404', () =>
      expect404('GET', `/api/v1/farms/${a.farmId}/fields`));
    it('POST under A farm → 404 (farm-scope blocks creation in a foreign farm)', () =>
      expect404('POST', `/api/v1/farms/${a.farmId}/fields`, {
        fieldNumber: 99,
        hectares: 1,
      }));
    it('GET item → 404', () =>
      expect404('GET', `/api/v1/farms/${a.farmId}/fields/${a.fieldId}`));
    it('PATCH item → 404', () =>
      expect404('PATCH', `/api/v1/farms/${a.farmId}/fields/${a.fieldId}`, {
        hectares: 99,
      }));
    it('DELETE item → 404', () =>
      expect404('DELETE', `/api/v1/farms/${a.farmId}/fields/${a.fieldId}`));
  });

  // -------------------------------------------------------------------------
  // Nested: stables
  // -------------------------------------------------------------------------
  describe("on A's stables", () => {
    it('LIST → 404', () =>
      expect404('GET', `/api/v1/farms/${a.farmId}/stables`));
    it('GET item → 404', () =>
      expect404('GET', `/api/v1/farms/${a.farmId}/stables/${a.stableId}`));
    it('PATCH item → 404', () =>
      expect404('PATCH', `/api/v1/farms/${a.farmId}/stables/${a.stableId}`, {
        currentCount: 1,
      }));
    it('DELETE item → 404', () =>
      expect404('DELETE', `/api/v1/farms/${a.farmId}/stables/${a.stableId}`));
  });

  // -------------------------------------------------------------------------
  // Nested: machinery
  // -------------------------------------------------------------------------
  describe("on A's machinery", () => {
    it('LIST → 404', () =>
      expect404('GET', `/api/v1/farms/${a.farmId}/machinery`));
    it('GET item → 404', () =>
      expect404('GET', `/api/v1/farms/${a.farmId}/machinery/${a.machineId}`));
    it('PATCH item → 404', () =>
      expect404('PATCH', `/api/v1/farms/${a.farmId}/machinery/${a.machineId}`, {
        name: 'stolen',
      }));
    it('DELETE item → 404', () =>
      expect404('DELETE', `/api/v1/farms/${a.farmId}/machinery/${a.machineId}`));
  });

  // -------------------------------------------------------------------------
  // Nested: animal-configs
  // -------------------------------------------------------------------------
  describe("on A's animal-configs", () => {
    it('LIST → 404', () =>
      expect404('GET', `/api/v1/farms/${a.farmId}/animal-configs`));
    it('GET cow → 404', () =>
      expect404('GET', `/api/v1/farms/${a.farmId}/animal-configs/cow`));
    it('PUT cow → 404', () =>
      expect404('PUT', `/api/v1/farms/${a.farmId}/animal-configs/cow`, {
        species: 'cow',
        count: 1,
      }));
    it('DELETE cow → 404', () =>
      expect404('DELETE', `/api/v1/farms/${a.farmId}/animal-configs/cow`));
  });

  // -------------------------------------------------------------------------
  // Nested: calculator-states
  // -------------------------------------------------------------------------
  describe("on A's calculator-states", () => {
    it('GET work_speed → 404', () =>
      expect404(
        'GET',
        `/api/v1/farms/${a.farmId}/calculator-states/work_speed`,
      ));
    it('PUT work_speed → 404', () =>
      expect404(
        'PUT',
        `/api/v1/farms/${a.farmId}/calculator-states/work_speed`,
        { efficiency: 0.7, activeMachineryIds: [] },
      ));
  });

  // -------------------------------------------------------------------------
  // A still owns everything afterwards (B's probes had no effect).
  // -------------------------------------------------------------------------
  it("A's resources are intact after B's probes", async () => {
    const farm = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/farms/${a.farmId}`,
      headers: userA.authHeader,
    });
    expect(farm.statusCode).toBe(200);

    const field = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/farms/${a.farmId}/fields/${a.fieldId}`,
      headers: userA.authHeader,
    });
    expect(field.statusCode).toBe(200);

    const stable = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/farms/${a.farmId}/stables/${a.stableId}`,
      headers: userA.authHeader,
    });
    expect(stable.statusCode).toBe(200);
  });
});
