/**
 * User Settings API integration tests (H4.6).
 *
 * Runs the real /api/v1/me/settings routes against a freshly-seeded
 * postgres:18-alpine. Covers docs/openapi.yaml + the active-farm ownership rule
 * (docs/base-de-datos.md §3, docs/autorizacion-api.md):
 *   - GET creates the row with defaults if missing
 *   - PATCH activeFarmId to one of the caller's OWN farms → 200
 *   - PATCH activeFarmId to ANOTHER user's farm → 422 FARM_NOT_OWNED
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

const BASE = '/api/v1/me/settings';

interface UserSettingsDto {
  userId: string;
  locale: string;
  theme: string;
  activeFarmId: string | null;
  preferences: Record<string, unknown>;
}

describe('User Settings API (H4.6)', () => {
  let ctx: DomainAppContext;
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    ctx = await bootstrapDomainApp();
    userA = await registerUser(ctx.app, 'settingsA');
    userB = await registerUser(ctx.app, 'settingsB');
  }, 120000);

  afterAll(async () => {
    await teardownDomainApp(ctx);
  });

  it('401 without a token', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: BASE });
    expect(res.statusCode).toBe(401);
  });

  it('GET returns settings (defaults; row exists from registration)', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: BASE,
      headers: userA.authHeader,
    });
    expect(res.statusCode).toBe(200);
    const settings = dataOf<UserSettingsDto>(res.payload);
    expect(settings.userId).toBe(userA.id);
    expect(settings.locale).toBe('es');
    expect(settings.theme).toBe('system');
    // Registration provisions the default farm as the active one.
    expect(settings.activeFarmId).toBe(userA.defaultFarmId);
  });

  it('PATCH 200 updates locale/theme/preferences', async () => {
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: BASE,
      headers: userA.authHeader,
      payload: { locale: 'en', theme: 'dark', preferences: { compact: true } },
    });
    expect(res.statusCode).toBe(200);
    const settings = dataOf<UserSettingsDto>(res.payload);
    expect(settings.locale).toBe('en');
    expect(settings.theme).toBe('dark');
    expect(settings.preferences).toMatchObject({ compact: true });
  });

  it('PATCH 200 sets activeFarmId to one of the caller OWN farms', async () => {
    // Create a second farm for userA and activate it.
    const farmRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/farms',
      headers: userA.authHeader,
      payload: { name: `Active ${Date.now()}` },
    });
    const ownFarmId = dataOf<{ id: string }>(farmRes.payload).id;

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: BASE,
      headers: userA.authHeader,
      payload: { activeFarmId: ownFarmId },
    });
    expect(res.statusCode).toBe(200);
    expect(dataOf<UserSettingsDto>(res.payload).activeFarmId).toBe(ownFarmId);
  });

  it('PATCH 200 clears activeFarmId with an explicit null', async () => {
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: BASE,
      headers: userA.authHeader,
      payload: { activeFarmId: null },
    });
    expect(res.statusCode).toBe(200);
    expect(dataOf<UserSettingsDto>(res.payload).activeFarmId).toBeNull();
  });

  it('PATCH 422 FARM_NOT_OWNED for another user farm as activeFarmId', async () => {
    // userB's default farm is not owned by userA.
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: BASE,
      headers: userA.authHeader,
      payload: { activeFarmId: userB.defaultFarmId },
    });
    expect(res.statusCode).toBe(422);
    expect(errorOf(res.payload).code).toBe('FARM_NOT_OWNED');
  });

  it('PATCH 422 VALIDATION_ERROR on an unknown key (strict body)', async () => {
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: BASE,
      headers: userA.authHeader,
      payload: { unexpected: 'x' },
    });
    expect(res.statusCode).toBe(422);
    expect(errorOf(res.payload).code).toBe('VALIDATION_ERROR');
  });
});
