/**
 * Auth integration tests (H3.4).
 *
 * These run the REAL plugin/route graph from src/app.ts (buildApp) against a
 * real, freshly-seeded postgres:18-alpine started by the shared Testcontainers
 * harness (tests/db/helpers.ts). Requests go through `app.inject`, so the
 * @fastify/jwt auth gate, the zod validation/serialization, the error-handler
 * envelope, the rate-limiter and every repository/service the routes touch are
 * exercised end-to-end. No mocks.
 *
 * IMPORTANT — module load ordering:
 *   src/config/env.ts reads process.env at import time and src/db/client.ts
 *   opens a postgres pool from env.DATABASE_URL at import time. The harness sets
 *   process.env.DATABASE_URL to the container URI inside startHarness(), so
 *   buildApp() (and the db client it transitively imports) MUST be imported
 *   AFTER the harness has started. We therefore import them dynamically in
 *   beforeAll, never statically at the top of this file.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { startHarness, stopHarness, type DbHarness } from '../db/helpers';

// ---------------------------------------------------------------------------
// Types for the dynamically-imported app/db modules (no runtime import here).
// ---------------------------------------------------------------------------
type BuildApp = typeof import('../../src/app').buildApp;
type DbClient = typeof import('../../src/db/client').db;
type IdentitySchema = typeof import('../../src/db/schema/identity');
type DomainSchema = typeof import('../../src/db/schema/domain');

// ---------------------------------------------------------------------------
// Small inject helpers + response envelope shapes.
// ---------------------------------------------------------------------------

interface AuthSessionBody {
  data: {
    user: { id: string; email: string; displayName: string | null; createdAt: string };
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

interface TokenPairBody {
  data: { accessToken: string; refreshToken: string; expiresIn: number };
}

interface UserBody {
  data: { id: string; email: string; displayName: string | null; createdAt: string };
}

interface ErrorBody {
  error: { code: string; message: string; details?: { path?: string; message: string }[] };
}

const BASE = '/api/v1/auth';

/** Generate a unique email so each test is independent of the others. */
function uniqueEmail(tag: string): string {
  return `${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
}

describe('Auth API (H3.4)', () => {
  let harness: DbHarness;
  let app: FastifyInstance;
  let db: DbClient;
  let identity: IdentitySchema;
  let domain: DomainSchema;

  beforeAll(async () => {
    harness = await startHarness();

    // Keep the limiter effectively out of the way for the functional tests;
    // the dedicated 429 test (below) uses its own app with a tiny max. The
    // limiter buckets by client IP and app.inject always reports 127.0.0.1, so
    // every login/register in THIS suite shares one bucket — a generous max
    // avoids flaky cross-test throttling.
    process.env.RATE_LIMIT_MAX = '1000';
    process.env.RATE_LIMIT_WINDOW = '1 minute';

    // Dynamic imports — only now that DATABASE_URL points at the container.
    const appMod = await import('../../src/app');
    const dbMod = await import('../../src/db/client');
    identity = await import('../../src/db/schema/identity');
    domain = await import('../../src/db/schema/domain');

    const buildApp: BuildApp = appMod.buildApp;
    db = dbMod.db;

    app = await buildApp({ logger: false });
    await app.ready();
  }, 120000);

  afterAll(async () => {
    await app?.close();
    // Close the app's own pool (src/db/client.ts), then the harness pool/container.
    const dbMod = await import('../../src/db/client');
    await dbMod.closeDb();
    await stopHarness(harness);
  });

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------
  describe('POST /auth/register', () => {
    it('201 returns user + tokens and provisions settings + default farm', async () => {
      const email = uniqueEmail('reg');
      const res = await app.inject({
        method: 'POST',
        url: `${BASE}/register`,
        payload: { email, password: 'supersecret', displayName: 'Granjero' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload) as AuthSessionBody;

      // User shape.
      expect(body.data.user.email).toBe(email);
      expect(body.data.user.displayName).toBe('Granjero');
      expect(body.data.user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(typeof body.data.user.createdAt).toBe('string');

      // Tokens.
      expect(typeof body.data.accessToken).toBe('string');
      expect(body.data.accessToken.length).toBeGreaterThan(0);
      expect(typeof body.data.refreshToken).toBe('string');
      expect(body.data.refreshToken.length).toBeGreaterThan(0);
      expect(body.data.expiresIn).toBe(900);

      // The internal passwordHash must never cross the boundary.
      expect(JSON.parse(res.payload)).not.toHaveProperty('data.user.passwordHash');
      expect(res.payload).not.toContain('passwordHash');

      // user_settings row exists with active_farm_id pointing at the default farm.
      const userId = body.data.user.id;
      const [settings] = await db
        .select()
        .from(identity.userSettings)
        .where(eq(identity.userSettings.userId, userId));
      expect(settings).toBeDefined();
      expect(settings.locale).toBe('es');
      expect(settings.theme).toBe('system');
      expect(settings.activeFarmId).not.toBeNull();

      // Default farm exists, is named 'Mi partida', and IS the active farm.
      const [farm] = await db
        .select()
        .from(domain.farms)
        .where(eq(domain.farms.userId, userId));
      expect(farm).toBeDefined();
      expect(farm.name).toBe('Mi partida');
      expect(farm.difficulty).toBe('normal');
      expect(farm.gameVersionId).toBe(harness.gameVersionId);
      expect(settings.activeFarmId).toBe(farm.id);

      // A refresh token row was persisted (only its hash, never the plaintext).
      const tokenRows = await db
        .select()
        .from(identity.refreshTokens)
        .where(eq(identity.refreshTokens.userId, userId));
      expect(tokenRows).toHaveLength(1);
      expect(tokenRows[0].tokenHash).not.toBe(body.data.refreshToken);
      expect(tokenRows[0].revokedAt).toBeNull();
    });

    it('409 EMAIL_ALREADY_REGISTERED on duplicate email (case-insensitive)', async () => {
      const email = uniqueEmail('dup');
      const first = await app.inject({
        method: 'POST',
        url: `${BASE}/register`,
        payload: { email, password: 'supersecret' },
      });
      expect(first.statusCode).toBe(201);

      const second = await app.inject({
        method: 'POST',
        url: `${BASE}/register`,
        // Upper-cased to confirm the citext unique constraint is honoured.
        payload: { email: email.toUpperCase(), password: 'anotherpass' },
      });
      expect(second.statusCode).toBe(409);
      const body = JSON.parse(second.payload) as ErrorBody;
      expect(body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('422 VALIDATION_ERROR on a weak (<8 char) password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `${BASE}/register`,
        payload: { email: uniqueEmail('weak'), password: 'short' },
      });
      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.payload) as ErrorBody;
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(body.error.details)).toBe(true);
      expect(body.error.details?.some((d) => d.path === 'password')).toBe(true);
    });

    it('422 VALIDATION_ERROR on a malformed email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `${BASE}/register`,
        payload: { email: 'not-an-email', password: 'supersecret' },
      });
      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.payload) as ErrorBody;
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details?.some((d) => d.path === 'email')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------
  describe('POST /auth/login', () => {
    const email = uniqueEmail('login');
    const password = 'correcthorse';

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: `${BASE}/register`,
        payload: { email, password },
      });
      expect(res.statusCode).toBe(201);
    });

    it('200 returns a fresh token pair for valid credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `${BASE}/login`,
        payload: { email, password },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload) as AuthSessionBody;
      expect(body.data.user.email).toBe(email);
      expect(body.data.accessToken.length).toBeGreaterThan(0);
      expect(body.data.refreshToken.length).toBeGreaterThan(0);
      expect(body.data.expiresIn).toBe(900);
    });

    it('401 INVALID_CREDENTIALS for a wrong password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `${BASE}/login`,
        payload: { email, password: 'wrongpassword' },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload) as ErrorBody;
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('401 INVALID_CREDENTIALS (same code) for an unknown email — no enumeration', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `${BASE}/login`,
        payload: { email: uniqueEmail('ghost'), password: 'whatever123' },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload) as ErrorBody;
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  // -------------------------------------------------------------------------
  // GET /auth/me
  // -------------------------------------------------------------------------
  describe('GET /auth/me', () => {
    it('401 UNAUTHORIZED without a token', async () => {
      const res = await app.inject({ method: 'GET', url: `${BASE}/me` });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload) as ErrorBody;
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('401 UNAUTHORIZED with a malformed bearer token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `${BASE}/me`,
        headers: { authorization: 'Bearer not.a.jwt' },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload) as ErrorBody;
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('200 returns the authenticated user with a valid access token', async () => {
      const email = uniqueEmail('me');
      const reg = await app.inject({
        method: 'POST',
        url: `${BASE}/register`,
        payload: { email, password: 'supersecret', displayName: 'Yo' },
      });
      const { data } = JSON.parse(reg.payload) as AuthSessionBody;

      const res = await app.inject({
        method: 'GET',
        url: `${BASE}/me`,
        headers: { authorization: `Bearer ${data.accessToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload) as UserBody;
      expect(body.data.id).toBe(data.user.id);
      expect(body.data.email).toBe(email);
      expect(body.data.displayName).toBe('Yo');
      expect(res.payload).not.toContain('passwordHash');
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /auth/me
  // -------------------------------------------------------------------------
  describe('PATCH /auth/me', () => {
    it('200 updates displayName', async () => {
      const email = uniqueEmail('patchname');
      const reg = await app.inject({
        method: 'POST',
        url: `${BASE}/register`,
        payload: { email, password: 'supersecret', displayName: 'Antes' },
      });
      const { data } = JSON.parse(reg.payload) as AuthSessionBody;

      const res = await app.inject({
        method: 'PATCH',
        url: `${BASE}/me`,
        headers: { authorization: `Bearer ${data.accessToken}` },
        payload: { displayName: 'Después' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload) as UserBody;
      expect(body.data.displayName).toBe('Después');
      expect(body.data.id).toBe(data.user.id);
    });

    it('401 INVALID_CREDENTIALS when newPassword is sent with a wrong currentPassword', async () => {
      const email = uniqueEmail('patchpwbad');
      const reg = await app.inject({
        method: 'POST',
        url: `${BASE}/register`,
        payload: { email, password: 'originalpass' },
      });
      const { data } = JSON.parse(reg.payload) as AuthSessionBody;

      const res = await app.inject({
        method: 'PATCH',
        url: `${BASE}/me`,
        headers: { authorization: `Bearer ${data.accessToken}` },
        payload: { currentPassword: 'totallywrong', newPassword: 'brandnewpass' },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload) as ErrorBody;
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('200 changes the password and the new password then works for login (old one fails)', async () => {
      const email = uniqueEmail('patchpwok');
      const oldPassword = 'originalpass';
      const newPassword = 'rotatedpass';
      const reg = await app.inject({
        method: 'POST',
        url: `${BASE}/register`,
        payload: { email, password: oldPassword },
      });
      const { data } = JSON.parse(reg.payload) as AuthSessionBody;

      const patch = await app.inject({
        method: 'PATCH',
        url: `${BASE}/me`,
        headers: { authorization: `Bearer ${data.accessToken}` },
        payload: { currentPassword: oldPassword, newPassword },
      });
      expect(patch.statusCode).toBe(200);

      // Old password no longer authenticates.
      const oldLogin = await app.inject({
        method: 'POST',
        url: `${BASE}/login`,
        payload: { email, password: oldPassword },
      });
      expect(oldLogin.statusCode).toBe(401);
      expect((JSON.parse(oldLogin.payload) as ErrorBody).error.code).toBe(
        'INVALID_CREDENTIALS',
      );

      // New password works.
      const newLogin = await app.inject({
        method: 'POST',
        url: `${BASE}/login`,
        payload: { email, password: newPassword },
      });
      expect(newLogin.statusCode).toBe(200);
      expect((JSON.parse(newLogin.payload) as AuthSessionBody).data.user.email).toBe(
        email,
      );
    });

    it('422 VALIDATION_ERROR when newPassword is provided without currentPassword', async () => {
      const email = uniqueEmail('patchnopw');
      const reg = await app.inject({
        method: 'POST',
        url: `${BASE}/register`,
        payload: { email, password: 'originalpass' },
      });
      const { data } = JSON.parse(reg.payload) as AuthSessionBody;

      const res = await app.inject({
        method: 'PATCH',
        url: `${BASE}/me`,
        headers: { authorization: `Bearer ${data.accessToken}` },
        payload: { newPassword: 'brandnewpass' },
      });
      expect(res.statusCode).toBe(422);
      expect((JSON.parse(res.payload) as ErrorBody).error.code).toBe(
        'VALIDATION_ERROR',
      );
    });
  });

  // -------------------------------------------------------------------------
  // refresh — rotation + reuse detection
  // -------------------------------------------------------------------------
  describe('POST /auth/refresh', () => {
    it('200 rotates a valid refresh token into a brand-new pair', async () => {
      const reg = await app.inject({
        method: 'POST',
        url: `${BASE}/register`,
        payload: { email: uniqueEmail('refresh'), password: 'supersecret' },
      });
      const { data } = JSON.parse(reg.payload) as AuthSessionBody;

      const res = await app.inject({
        method: 'POST',
        url: `${BASE}/refresh`,
        payload: { refreshToken: data.refreshToken },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload) as TokenPairBody;
      expect(body.data.accessToken.length).toBeGreaterThan(0);
      expect(body.data.refreshToken.length).toBeGreaterThan(0);
      // The rotated token must differ from the one presented.
      expect(body.data.refreshToken).not.toBe(data.refreshToken);
      expect(body.data.expiresIn).toBe(900);

      // The new token works once.
      const again = await app.inject({
        method: 'POST',
        url: `${BASE}/refresh`,
        payload: { refreshToken: body.data.refreshToken },
      });
      expect(again.statusCode).toBe(200);
    });

    it('401 INVALID_REFRESH_TOKEN for an unknown token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `${BASE}/refresh`,
        payload: { refreshToken: 'this-token-was-never-issued' },
      });
      expect(res.statusCode).toBe(401);
      expect((JSON.parse(res.payload) as ErrorBody).error.code).toBe(
        'INVALID_REFRESH_TOKEN',
      );
    });

    it('401 REFRESH_TOKEN_REUSED on replaying a rotated token AND revokes the whole chain', async () => {
      const reg = await app.inject({
        method: 'POST',
        url: `${BASE}/register`,
        payload: { email: uniqueEmail('reuse'), password: 'supersecret' },
      });
      const original = (JSON.parse(reg.payload) as AuthSessionBody).data.refreshToken;

      // First rotation: original -> rotated. `original` is now spent.
      const firstRotate = await app.inject({
        method: 'POST',
        url: `${BASE}/refresh`,
        payload: { refreshToken: original },
      });
      expect(firstRotate.statusCode).toBe(200);
      const rotated = (JSON.parse(firstRotate.payload) as TokenPairBody).data
        .refreshToken;

      // Reuse the OLD (already-rotated) token -> reuse detected.
      const reuse = await app.inject({
        method: 'POST',
        url: `${BASE}/refresh`,
        payload: { refreshToken: original },
      });
      expect(reuse.statusCode).toBe(401);
      expect((JSON.parse(reuse.payload) as ErrorBody).error.code).toBe(
        'REFRESH_TOKEN_REUSED',
      );

      // The chain is now revoked: the freshly-rotated token also fails. Because
      // it was active (not rotated), the family-revoke makes it look revoked,
      // so the service answers REFRESH_TOKEN_REUSED for it too.
      const rotatedAfter = await app.inject({
        method: 'POST',
        url: `${BASE}/refresh`,
        payload: { refreshToken: rotated },
      });
      expect(rotatedAfter.statusCode).toBe(401);
      expect((JSON.parse(rotatedAfter.payload) as ErrorBody).error.code).toBe(
        'REFRESH_TOKEN_REUSED',
      );
    });
  });

  // -------------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------------
  describe('POST /auth/logout', () => {
    it('204 is idempotent (twice) and the token stops working afterwards', async () => {
      const reg = await app.inject({
        method: 'POST',
        url: `${BASE}/register`,
        payload: { email: uniqueEmail('logout'), password: 'supersecret' },
      });
      const refreshToken = (JSON.parse(reg.payload) as AuthSessionBody).data
        .refreshToken;

      const first = await app.inject({
        method: 'POST',
        url: `${BASE}/logout`,
        payload: { refreshToken },
      });
      expect(first.statusCode).toBe(204);

      const second = await app.inject({
        method: 'POST',
        url: `${BASE}/logout`,
        payload: { refreshToken },
      });
      expect(second.statusCode).toBe(204);

      // After logout the refresh token is revoked → refreshing it is reuse.
      const afterLogout = await app.inject({
        method: 'POST',
        url: `${BASE}/refresh`,
        payload: { refreshToken },
      });
      expect(afterLogout.statusCode).toBe(401);
      expect((JSON.parse(afterLogout.payload) as ErrorBody).error.code).toBe(
        'REFRESH_TOKEN_REUSED',
      );
    });

    it('204 even for an unknown/never-issued token (pure idempotency)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `${BASE}/logout`,
        payload: { refreshToken: 'never-issued-token' },
      });
      expect(res.statusCode).toBe(204);
    });
  });
});

// ---------------------------------------------------------------------------
// Rate limiting — isolated app with a tiny RATE_LIMIT_MAX.
//
// authRateLimit (src/plugins/rate-limit.ts) captures env.RATE_LIMIT_MAX at
// module-eval time, so to get a small limit we reset the module registry, set
// a low max in the environment, then re-import buildApp so a FRESH route module
// reads the new value. The db client is re-imported against the same container
// (DATABASE_URL is unchanged), so it keeps talking to the seeded database.
// ---------------------------------------------------------------------------
describe('Auth API rate limiting (H3.4)', () => {
  let harness: DbHarness;
  let app: FastifyInstance;

  const RL_MAX = 3;

  beforeAll(async () => {
    harness = await startHarness();

    process.env.RATE_LIMIT_MAX = String(RL_MAX);
    process.env.RATE_LIMIT_WINDOW = '1 minute';

    // Force fresh module evaluation so env-derived config (and the route's
    // authRateLimit) picks up RATE_LIMIT_MAX, and so db/client binds to THIS
    // harness's DATABASE_URL.
    vi.resetModules();

    const appMod = await import('../../src/app');
    app = await appMod.buildApp({ logger: false });
    await app.ready();
  }, 120000);

  afterAll(async () => {
    await app?.close();
    const dbMod = await import('../../src/db/client');
    await dbMod.closeDb();
    await stopHarness(harness);
    vi.resetModules();
  });

  it('429 RATE_LIMITED once /auth/login exceeds RATE_LIMIT_MAX in the window', async () => {
    const payload = { email: uniqueEmail('rl'), password: 'whatever123' };

    const statuses: number[] = [];
    // Fire max + 2 requests; the limiter buckets by IP (127.0.0.1 under inject)
    // so they all share one window.
    for (let i = 0; i < RL_MAX + 2; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: `${BASE}/login`,
        payload,
      });
      statuses.push(res.statusCode);
    }

    // At least one request must be throttled, and the last one definitely is.
    const limited = statuses.filter((s) => s === 429);
    expect(limited.length).toBeGreaterThan(0);

    const lastRes = await app.inject({
      method: 'POST',
      url: `${BASE}/login`,
      payload,
    });
    expect(lastRes.statusCode).toBe(429);
    const body = JSON.parse(lastRes.payload) as ErrorBody;
    expect(body.error.code).toBe('RATE_LIMITED');
  });
});
