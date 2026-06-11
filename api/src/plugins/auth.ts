/**
 * Authentication plugin (H3.1).
 *
 * Responsibilities:
 *   1. Register `@fastify/jwt` with the configured secret and access-token TTL.
 *   2. Map the signed payload `{ sub, email }` to `request.user = { id, email }`
 *      via `formatUser`.
 *   3. Decorate the instance with an `authenticate` pre-handler.
 *   4. Install a GLOBAL `onRequest` hook that enforces auth on every route,
 *      EXCEPT routes that opt out with route config `{ public: true }`
 *      (e.g. health, auth/register, auth/login, auth/refresh, auth/logout).
 *
 * On JWT failure we throw an {@link AppError} so the error-handler plugin
 * produces the standard envelope (`TOKEN_EXPIRED` for expiry, `UNAUTHORIZED`
 * otherwise). See `docs/autorizacion-api.md` and `docs/arquitectura-api.md` §9.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fp from 'fastify-plugin';

import { env } from '../config/env';
import { UnauthorizedError } from '../lib/errors';

/** @fastify/jwt error code emitted when the token's `exp` has passed. */
const JWT_EXPIRED_CODE = 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED';

/**
 * Normalise any `request.jwtVerify()` rejection into a domain `UnauthorizedError`.
 * Expired tokens get `TOKEN_EXPIRED` (a refresh signal for the client); every
 * other JWT failure (missing/invalid/untrusted token) collapses to
 * `UNAUTHORIZED` so we don't leak which check failed.
 */
function toAuthError(err: unknown): UnauthorizedError {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? (err as { code?: unknown }).code
      : undefined;

  if (code === JWT_EXPIRED_CODE) {
    return new UnauthorizedError('TOKEN_EXPIRED', 'Access token expired');
  }
  return new UnauthorizedError('UNAUTHORIZED', 'Authentication required');
}

async function authPlugin(app: import('fastify').FastifyInstance): Promise<void> {
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      // expiresIn accepts a number of seconds; ACCESS_TOKEN_TTL is in seconds.
      expiresIn: env.ACCESS_TOKEN_TTL,
    },
    // Translate signed claims into the shape exposed on request.user.
    formatUser: (payload) => ({
      id: (payload as { sub: string }).sub,
      email: (payload as { email: string }).email,
    }),
  });

  /**
   * Verify the access token and populate `request.user`. `@fastify/jwt`'s
   * `formatUser` already produces `{ id, email }`, so a successful verify is all
   * we need; failures are rethrown as domain errors.
   */
  const authenticate = async (
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> => {
    try {
      await request.jwtVerify();
    } catch (err) {
      throw toAuthError(err);
    }
  };

  app.decorate('authenticate', authenticate);

  // Global gate: every route requires auth unless it opted out via { public: true }.
  app.addHook('onRequest', async (request, reply) => {
    if (request.routeOptions?.config?.public === true) {
      return;
    }
    // Swagger docs must be browsable without a token (H4.1). @fastify/swagger-ui
    // registers its routes (UI, openapi.json, static assets) under /api/v1/docs
    // and we can't set our `{ public: true }` config on them, so skip auth for
    // that whole subtree here. Kept narrow (exact prefix) to avoid widening the
    // public surface beyond the docs.
    if (request.url.startsWith('/api/v1/docs')) {
      return;
    }
    await authenticate(request, reply);
  });
}

export default fp(authPlugin, {
  name: 'auth',
  fastify: '5.x',
});
