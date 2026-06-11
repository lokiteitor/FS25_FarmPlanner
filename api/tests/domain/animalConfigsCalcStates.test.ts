/**
 * AnimalConfigs + CalculatorStates API integration tests (H4.5).
 *
 * Runs the real /api/v1/farms/:farmId/{animal-configs,calculator-states} routes
 * against a freshly-seeded postgres:18-alpine. Covers docs/openapi.yaml +
 * docs/base-de-datos.md §13/§14:
 *   - animal-configs: PUT /cow with valid CowInputs → 201 then 200 (upsert);
 *     body.species != path species → 422; inputs with a `difficulty` key → 422;
 *     GET list; GET unknown species → 404 CONFIG_NOT_FOUND; DELETE
 *   - calculator-states: PUT /work_speed with a valid state; GET; unknown
 *     toolKey → 422 (route-level zod enum rejects it before the handler)
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

interface AnimalConfigDto {
  id: string;
  farmId: string;
  species: string;
  schemaVersion: number;
  inputs: Record<string, unknown>;
}

interface CalculatorStateDto {
  id: string;
  farmId: string;
  toolKey: string;
  state: Record<string, unknown>;
}

describe('AnimalConfigs + CalculatorStates API (H4.5)', () => {
  let ctx: DomainAppContext;
  let user: TestUser;
  let farmId: string;

  function configsUrl(): string {
    return `/api/v1/farms/${farmId}/animal-configs`;
  }
  function statesUrl(): string {
    return `/api/v1/farms/${farmId}/calculator-states`;
  }

  beforeAll(async () => {
    ctx = await bootstrapDomainApp();
    user = await registerUser(ctx.app, 'configs');
    farmId = user.defaultFarmId;
  }, 120000);

  afterAll(async () => {
    await teardownDomainApp(ctx);
  });

  // =========================================================================
  // AnimalConfigs
  // =========================================================================
  describe('AnimalConfigs', () => {
    it('PUT /cow with valid CowInputs → 201 (created) then 200 (replaced)', async () => {
      const created = await ctx.app.inject({
        method: 'PUT',
        url: `${configsUrl()}/cow`,
        headers: user.authHeader,
        payload: {
          species: 'cow',
          count: 45,
          yieldBonus: 0.425,
          feedType: 'tmr',
          provideStraw: true,
          grassHarvests: 2,
          breed: 'Holstein',
        },
      });
      expect(created.statusCode).toBe(201);
      const cfg = dataOf<AnimalConfigDto>(created.payload);
      expect(cfg.species).toBe('cow');
      expect(cfg.farmId).toBe(farmId);
      expect(cfg.inputs).toMatchObject({ species: 'cow', count: 45 });

      // Second PUT for the same (farm, species) replaces → 200.
      const replaced = await ctx.app.inject({
        method: 'PUT',
        url: `${configsUrl()}/cow`,
        headers: user.authHeader,
        payload: { species: 'cow', count: 60 },
      });
      expect(replaced.statusCode).toBe(200);
      expect(
        (dataOf<AnimalConfigDto>(replaced.payload).inputs as { count: number })
          .count,
      ).toBe(60);
    });

    it('422 VALIDATION_ERROR when body.species differs from the path species', async () => {
      const res = await ctx.app.inject({
        method: 'PUT',
        url: `${configsUrl()}/sheep`,
        headers: user.authHeader,
        payload: { species: 'cow', count: 5 },
      });
      expect(res.statusCode).toBe(422);
      expect(errorOf(res.payload).code).toBe('VALIDATION_ERROR');
    });

    it('422 VALIDATION_ERROR when inputs carry a forbidden `difficulty` key', async () => {
      const res = await ctx.app.inject({
        method: 'PUT',
        url: `${configsUrl()}/cow`,
        headers: user.authHeader,
        payload: { species: 'cow', count: 10, difficulty: 'hard' },
      });
      expect(res.statusCode).toBe(422);
      expect(errorOf(res.payload).code).toBe('VALIDATION_ERROR');
    });

    it('422 CROP_VERSION_MISMATCH for an unknown crop slug in inputs', async () => {
      const res = await ctx.app.inject({
        method: 'PUT',
        url: `${configsUrl()}/cow`,
        headers: user.authHeader,
        payload: { species: 'cow', count: 10, silageCrop: 'not_a_real_crop' },
      });
      expect(res.statusCode).toBe(422);
      expect(errorOf(res.payload).code).toBe('CROP_VERSION_MISMATCH');
    });

    it('GET list returns the saved configs', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: configsUrl(),
        headers: user.authHeader,
      });
      expect(res.statusCode).toBe(200);
      const list = dataOf<AnimalConfigDto[]>(res.payload);
      expect(list.some((c) => c.species === 'cow')).toBe(true);
    });

    it('GET an unsaved species → 404 CONFIG_NOT_FOUND', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `${configsUrl()}/horse`,
        headers: user.authHeader,
      });
      expect(res.statusCode).toBe(404);
      expect(errorOf(res.payload).code).toBe('CONFIG_NOT_FOUND');
    });

    it('DELETE 204 then 404 CONFIG_NOT_FOUND', async () => {
      // Ensure a goat config exists first.
      const put = await ctx.app.inject({
        method: 'PUT',
        url: `${configsUrl()}/goat`,
        headers: user.authHeader,
        payload: { species: 'goat', count: 12 },
      });
      expect(put.statusCode).toBe(201);

      const del = await ctx.app.inject({
        method: 'DELETE',
        url: `${configsUrl()}/goat`,
        headers: user.authHeader,
      });
      expect(del.statusCode).toBe(204);

      const again = await ctx.app.inject({
        method: 'DELETE',
        url: `${configsUrl()}/goat`,
        headers: user.authHeader,
      });
      expect(again.statusCode).toBe(404);
      expect(errorOf(again.payload).code).toBe('CONFIG_NOT_FOUND');
    });
  });

  // =========================================================================
  // CalculatorStates
  // =========================================================================
  describe('CalculatorStates', () => {
    it('PUT /work_speed with a valid state → 200, then GET returns it', async () => {
      const state = {
        hectares: 20,
        selectedFieldId: null,
        efficiency: 0.85,
        activeMachineryIds: [],
      };
      const put = await ctx.app.inject({
        method: 'PUT',
        url: `${statesUrl()}/work_speed`,
        headers: user.authHeader,
        payload: state,
      });
      expect(put.statusCode).toBe(200);
      const saved = dataOf<CalculatorStateDto>(put.payload);
      expect(saved.toolKey).toBe('work_speed');
      expect(saved.state).toMatchObject({ hectares: 20, efficiency: 0.85 });

      const get = await ctx.app.inject({
        method: 'GET',
        url: `${statesUrl()}/work_speed`,
        headers: user.authHeader,
      });
      expect(get.statusCode).toBe(200);
      expect(dataOf<CalculatorStateDto>(get.payload).toolKey).toBe('work_speed');
    });

    it('PUT /work_speed upserts (a second PUT replaces the state)', async () => {
      const second = await ctx.app.inject({
        method: 'PUT',
        url: `${statesUrl()}/work_speed`,
        headers: user.authHeader,
        payload: { efficiency: 0.6, activeMachineryIds: [] },
      });
      expect(second.statusCode).toBe(200);
      expect(
        (dataOf<CalculatorStateDto>(second.payload).state as {
          efficiency: number;
        }).efficiency,
      ).toBe(0.6);
    });

    it('GET /work_speed for a farm with no state → 404 CALCULATOR_STATE_NOT_FOUND', async () => {
      // A fresh farm has no calculator state yet.
      const farmRes = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/farms',
        headers: user.authHeader,
        payload: { name: `CalcEmpty ${Date.now()}` },
      });
      const emptyFarmId = dataOf<{ id: string }>(farmRes.payload).id;

      const res = await ctx.app.inject({
        method: 'GET',
        url: `/api/v1/farms/${emptyFarmId}/calculator-states/work_speed`,
        headers: user.authHeader,
      });
      expect(res.statusCode).toBe(404);
      expect(errorOf(res.payload).code).toBe('CALCULATOR_STATE_NOT_FOUND');
    });

    it('422 VALIDATION_ERROR for an efficiency out of the 0.5..1 range', async () => {
      const res = await ctx.app.inject({
        method: 'PUT',
        url: `${statesUrl()}/work_speed`,
        headers: user.authHeader,
        payload: { efficiency: 2, activeMachineryIds: [] },
      });
      expect(res.statusCode).toBe(422);
      expect(errorOf(res.payload).code).toBe('VALIDATION_ERROR');
    });

    it('unknown toolKey → 422 VALIDATION_ERROR (route enum rejects it)', async () => {
      const res = await ctx.app.inject({
        method: 'PUT',
        url: `${statesUrl()}/not_a_tool`,
        headers: user.authHeader,
        payload: { efficiency: 0.8, activeMachineryIds: [] },
      });
      // The route's {toolKey} zod enum (work_speed only) rejects the path param,
      // so this surfaces as a route-level 422 VALIDATION_ERROR before the handler.
      expect(res.statusCode).toBe(422);
      expect(errorOf(res.payload).code).toBe('VALIDATION_ERROR');
    });

    it('GET unknown toolKey → 422 VALIDATION_ERROR (route enum rejects it)', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `${statesUrl()}/not_a_tool`,
        headers: user.authHeader,
      });
      expect(res.statusCode).toBe(422);
      expect(errorOf(res.payload).code).toBe('VALIDATION_ERROR');
    });
  });
});
