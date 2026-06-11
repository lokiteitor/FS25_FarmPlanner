/**
 * Shared setup for the H4 domain integration tests.
 *
 * Mirrors the auth integration suite (tests/auth/auth.test.ts): each test file
 * spins up the shared Testcontainers harness (tests/db/helpers.ts) — a real
 * postgres:18-alpine migrated + seeded with the v1 catalog — then dynamically
 * imports buildApp() AFTER `process.env.DATABASE_URL` points at the container, so
 * src/config/env.ts and src/db/client.ts (which read env at import time) bind to
 * the right database. Requests go through `app.inject`, exercising the REAL
 * plugin/route graph (auth gate, farm-scope, zod validation/serialisation, the
 * error-handler envelope, every repository/service) end-to-end. No mocks.
 *
 * This module centralises the boilerplate every domain suite needs:
 *  - {@link bootstrapDomainApp}: start the harness + build the app with the rate
 *    limiter effectively disabled (a generous max so the per-IP bucket under
 *    inject never throttles functional tests).
 *  - {@link registerUser}: register a fresh user via POST /auth/register and
 *    return its tokens + the default farm id, plus a ready-to-use auth header.
 *  - response envelope shapes shared across the suites.
 */

import type { FastifyInstance } from 'fastify';

import {
  startHarness,
  stopHarness,
  type DbHarness,
} from '../db/helpers';

export type BuildApp = typeof import('../../src/app').buildApp;
export type DbClient = typeof import('../../src/db/client').db;

const AUTH_BASE = '/api/v1/auth';

// ---------------------------------------------------------------------------
// Envelope shapes (the success envelope is `{ data, meta? }`; errors `{ error }`).
// ---------------------------------------------------------------------------

export interface DataBody<T> {
  data: T;
  meta?: unknown;
}

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: { path?: string; message: string }[];
  };
}

export interface AuthSession {
  user: {
    id: string;
    email: string;
    displayName: string | null;
    createdAt: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** A registered user ready to drive authenticated requests. */
export interface TestUser {
  id: string;
  email: string;
  accessToken: string;
  /** `{ authorization: 'Bearer <token>' }`, spread into inject headers. */
  authHeader: { authorization: string };
  /** The default farm created at registration ("Mi partida"). */
  defaultFarmId: string;
}

/** The bundle every domain suite holds in `beforeAll`. */
export interface DomainAppContext {
  harness: DbHarness;
  app: FastifyInstance;
  db: DbClient;
}

/** Generate a unique email so each registration is independent. */
export function uniqueEmail(tag: string): string {
  return `${tag}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}@example.com`;
}

/**
 * Start the harness, point DATABASE_URL at it, neutralise the rate limiter, then
 * dynamically import + build the app and the db client. Returns the context the
 * suite tears down in `afterAll` via {@link teardownDomainApp}.
 */
export async function bootstrapDomainApp(): Promise<DomainAppContext> {
  const harness = await startHarness();

  // The limiter buckets by client IP and app.inject always reports 127.0.0.1,
  // so a tiny default would throttle unrelated tests sharing the bucket. Use a
  // generous max for these functional suites.
  process.env.RATE_LIMIT_MAX = '100000';
  process.env.RATE_LIMIT_WINDOW = '1 minute';

  const appMod = await import('../../src/app');
  const dbMod = await import('../../src/db/client');

  const app = await appMod.buildApp({ logger: false });
  await app.ready();

  return { harness, app, db: dbMod.db };
}

/** Close the app + its pool, then stop the harness pool/container. */
export async function teardownDomainApp(
  ctx: DomainAppContext | undefined,
): Promise<void> {
  if (!ctx) return;
  await ctx.app?.close();
  const dbMod = await import('../../src/db/client');
  await dbMod.closeDb();
  await stopHarness(ctx.harness);
}

/**
 * Register a brand-new user through the public API and return its credentials.
 * Registration also provisions the user_settings row and the default farm
 * ("Mi partida"), so the returned `defaultFarmId` is a real owned farm.
 */
export async function registerUser(
  app: FastifyInstance,
  tag = 'user',
): Promise<TestUser> {
  const email = uniqueEmail(tag);
  const res = await app.inject({
    method: 'POST',
    url: `${AUTH_BASE}/register`,
    payload: { email, password: 'supersecret', displayName: `T ${tag}` },
  });
  if (res.statusCode !== 201) {
    throw new Error(
      `registerUser(${tag}) expected 201, got ${res.statusCode}: ${res.payload}`,
    );
  }
  const session = (JSON.parse(res.payload) as DataBody<AuthSession>).data;

  // The default farm is the user's only farm right after registration.
  const farmsRes = await app.inject({
    method: 'GET',
    url: '/api/v1/farms',
    headers: { authorization: `Bearer ${session.accessToken}` },
  });
  const farms = (
    JSON.parse(farmsRes.payload) as DataBody<{ id: string; name: string }[]>
  ).data;
  const defaultFarm = farms.find((f) => f.name === 'Mi partida') ?? farms[0];

  return {
    id: session.user.id,
    email,
    accessToken: session.accessToken,
    authHeader: { authorization: `Bearer ${session.accessToken}` },
    defaultFarmId: defaultFarm.id,
  };
}

/** Parse the JSON `{ data }` body of a successful inject response. */
export function dataOf<T>(payload: string): T {
  return (JSON.parse(payload) as DataBody<T>).data;
}

/** Parse the JSON `{ error }` body of a failed inject response. */
export function errorOf(payload: string): ErrorBody['error'] {
  return (JSON.parse(payload) as ErrorBody).error;
}
