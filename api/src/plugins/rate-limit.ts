/**
 * Rate-limiting plugin (H3.4).
 *
 * Registers `@fastify/rate-limit` but keeps it GLOBALLY DISABLED: by default no
 * route is throttled. Specific routes opt in by attaching {@link authRateLimit}
 * to their config — in v1 only `/auth/login` and `/auth/register`
 * (`docs/arquitectura-api.md` §9).
 *
 * The error response is customised to the project envelope so a throttled
 * request answers `429 { error: { code: 'RATE_LIMITED', message } }`.
 */

import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';

import { env } from '../config/env';
import { RateLimitedError } from '../lib/errors';

/**
 * Per-route config to attach to throttled auth endpoints:
 *
 * @example
 *   app.post('/auth/login', { config: { public: true, ...authRateLimit }, schema }, handler)
 */
export const authRateLimit = {
  rateLimit: {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
  },
} as const;

async function rateLimitPlugin(
  app: import('fastify').FastifyInstance,
): Promise<void> {
  await app.register(rateLimit, {
    // Disabled by default; only routes carrying `authRateLimit` are limited.
    global: false,
    // Shared defaults applied when a route opts in without overriding them.
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    // Emit the project error envelope instead of the plugin's default body.
    // @fastify/rate-limit THROWS whatever this returns, so it must be an Error
    // carrying `statusCode` — otherwise the global error-handler can't tell it
    // is a 429 and masks it as 500. Returning a RateLimitedError (statusCode
    // 429, code RATE_LIMITED) makes the handler emit the standard envelope.
    errorResponseBuilder: () => new RateLimitedError(),
  });
}

export default fp(rateLimitPlugin, {
  name: 'rate-limit',
  fastify: '5.x',
});
