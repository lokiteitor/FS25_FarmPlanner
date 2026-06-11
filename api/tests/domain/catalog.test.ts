/**
 * Catalog API integration tests (H4.1).
 *
 * Runs the real /api/v1/catalog/* routes against a freshly-seeded
 * postgres:18-alpine. Verifies the read-only catalog contract from
 * docs/openapi.yaml + the caching contract from docs/arquitectura-api.md §13:
 *   - crops: 25 rows, ETag + Cache-Control, If-None-Match → 304
 *   - silage-crops: includes the derived cropSlug
 *   - animal-types: 7 species
 *   - constants: flattened key→value (defaultYieldBonus 0.425)
 *   - every endpoint requires auth (401 without a token)
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

const BASE = '/api/v1/catalog';

interface CropDto {
  id: string;
  slug: string;
  nameEs: string;
  nameEn: string;
  yieldPerM2: number;
  basePrice: number;
}

interface SilageCropDto {
  id: string;
  cropId: string;
  cropSlug: string;
  yieldPerM2: number;
  chaffFactor: number;
}

interface AnimalTypeDto {
  id: string;
  species: string;
  nameEs: string;
  monthlyRates: Record<string, number>;
  feedOptions: Record<string, unknown>;
}

interface GameConstantsDto {
  defaultYieldBonus?: number;
  silagePrice?: number;
  incomeDifficultyScalars?: { easy: number; normal: number; hard: number };
  milkPriceScalars?: { average: number; max: number; monthly: unknown[] };
  [k: string]: unknown;
}

describe('Catalog API (H4.1)', () => {
  let ctx: DomainAppContext;
  let user: TestUser;

  beforeAll(async () => {
    ctx = await bootstrapDomainApp();
    user = await registerUser(ctx.app, 'catalog');
  }, 120000);

  afterAll(async () => {
    await teardownDomainApp(ctx);
  });

  // -------------------------------------------------------------------------
  // auth gate
  // -------------------------------------------------------------------------
  describe('auth gate', () => {
    it('401 without a token on /crops', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: `${BASE}/crops` });
      expect(res.statusCode).toBe(401);
      expect(errorOf(res.payload).code).toBe('UNAUTHORIZED');
    });

    it('401 without a token on /animal-types', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `${BASE}/animal-types`,
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // game-versions
  // -------------------------------------------------------------------------
  it('GET /game-versions lists the single active seeded version', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `${BASE}/game-versions`,
      headers: user.authHeader,
    });
    expect(res.statusCode).toBe(200);
    const versions = dataOf<{ id: string; label: string; isActive: boolean }[]>(
      res.payload,
    );
    expect(versions).toHaveLength(1);
    expect(versions[0].id).toBe(ctx.harness.gameVersionId);
    expect(versions[0].isActive).toBe(true);
  });

  // -------------------------------------------------------------------------
  // crops + caching
  // -------------------------------------------------------------------------
  describe('GET /crops', () => {
    it('200 returns 25 crops with ETag + Cache-Control and meta.gameVersionId', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `${BASE}/crops`,
        headers: user.authHeader,
      });
      expect(res.statusCode).toBe(200);

      const crops = dataOf<CropDto[]>(res.payload);
      expect(crops).toHaveLength(25);

      // The seeded catalog includes wheat and poplar (docs/base-de-datos.md §5).
      const slugs = crops.map((c) => c.slug);
      expect(slugs).toContain('wheat');
      expect(slugs).toContain('poplar');
      expect(slugs).toContain('onion');

      // meta carries the resolved version.
      const meta = (
        JSON.parse(res.payload) as { meta: { gameVersionId: string } }
      ).meta;
      expect(meta.gameVersionId).toBe(ctx.harness.gameVersionId);

      // Caching headers (docs/arquitectura-api.md §13).
      const etag = res.headers.etag;
      expect(typeof etag).toBe('string');
      expect(etag).toBe(`W/"gv-${ctx.harness.gameVersionId}"`);
      expect(res.headers['cache-control']).toBe('public, max-age=86400');
    });

    it('304 Not Modified when If-None-Match matches the ETag', async () => {
      const first = await ctx.app.inject({
        method: 'GET',
        url: `${BASE}/crops`,
        headers: user.authHeader,
      });
      const etag = first.headers.etag as string;

      const second = await ctx.app.inject({
        method: 'GET',
        url: `${BASE}/crops`,
        headers: { ...user.authHeader, 'if-none-match': etag },
      });
      expect(second.statusCode).toBe(304);
      expect(second.payload).toBe('');
      // The validator + cache policy are reaffirmed on the 304.
      expect(second.headers.etag).toBe(etag);
    });

    it('200 (not 304) when If-None-Match is a stale/unrelated validator', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `${BASE}/crops`,
        headers: { ...user.authHeader, 'if-none-match': 'W/"gv-stale"' },
      });
      expect(res.statusCode).toBe(200);
      expect(dataOf<CropDto[]>(res.payload)).toHaveLength(25);
    });
  });

  // -------------------------------------------------------------------------
  // silage-crops
  // -------------------------------------------------------------------------
  it('GET /silage-crops includes the derived cropSlug', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `${BASE}/silage-crops`,
      headers: user.authHeader,
    });
    expect(res.statusCode).toBe(200);

    const silage = dataOf<SilageCropDto[]>(res.payload);
    expect(silage.length).toBeGreaterThan(0);
    for (const row of silage) {
      expect(typeof row.cropSlug).toBe('string');
      expect(row.cropSlug.length).toBeGreaterThan(0);
      expect(typeof row.cropId).toBe('string');
    }
    // wheat is silage-capable; onion is not (docs/base-de-datos.md §6).
    const silageSlugs = silage.map((s) => s.cropSlug);
    expect(silageSlugs).toContain('wheat');
    expect(silageSlugs).not.toContain('onion');

    expect(res.headers['cache-control']).toBe('public, max-age=86400');
  });

  // -------------------------------------------------------------------------
  // animal-types
  // -------------------------------------------------------------------------
  it('GET /animal-types returns 7 species with rates + feed options', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `${BASE}/animal-types`,
      headers: user.authHeader,
    });
    expect(res.statusCode).toBe(200);

    const animals = dataOf<AnimalTypeDto[]>(res.payload);
    expect(animals).toHaveLength(7);

    const species = animals.map((a) => a.species).sort();
    expect(species).toEqual(
      ['buffalo', 'chicken', 'cow', 'goat', 'horse', 'pig', 'sheep'].sort(),
    );

    const cow = animals.find((a) => a.species === 'cow');
    expect(cow).toBeDefined();
    // Cow monthly rates carry the milk-ruminant keys (docs/base-de-datos.md §7).
    expect(cow!.monthlyRates).toMatchObject({ milk: expect.any(Number) });
    // Cow feed options carry the silageCrops list.
    expect(Array.isArray(cow!.feedOptions.silageCrops)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // constants
  // -------------------------------------------------------------------------
  it('GET /constants returns the flattened constants (defaultYieldBonus 0.425)', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `${BASE}/constants`,
      headers: user.authHeader,
    });
    expect(res.statusCode).toBe(200);

    const constants = dataOf<GameConstantsDto>(res.payload);
    expect(constants.defaultYieldBonus).toBeCloseTo(0.425, 6);
    expect(constants.silagePrice).toBeCloseTo(0.121, 6);
    // Nested constants are flattened to camelCase keys, not snake_case rows.
    expect(constants.incomeDifficultyScalars).toMatchObject({
      easy: 3.0,
      normal: 1.8,
      hard: 1.0,
    });
    expect(constants.milkPriceScalars?.monthly).toHaveLength(12);
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
  });

  it('404 GAME_VERSION_NOT_FOUND for an unknown ?gameVersionId', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `${BASE}/crops?gameVersionId=00000000-0000-0000-0000-000000000000`,
      headers: user.authHeader,
    });
    // The resolver throws when the explicit version does not exist.
    expect(res.statusCode).toBe(404);
  });
});
