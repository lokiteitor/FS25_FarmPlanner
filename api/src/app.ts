import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import { env } from './config/env';
import errorHandlerPlugin from './plugins/error-handler';
import authPlugin from './plugins/auth';
import rateLimitPlugin from './plugins/rate-limit';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';

export interface BuildAppOptions {
  /** Override the Fastify logger configuration (e.g. disable in tests). */
  logger?: FastifyServerOptions['logger'];
}

/**
 * Build a fully wired Fastify instance.
 *
 * This factory is the single source of truth for app composition and is reused
 * by both the HTTP server (`server.ts`) and the test harness so they exercise
 * exactly the same plugin/route graph.
 */
export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      opts.logger ??
      ({
        level: env.LOG_LEVEL,
      } as FastifyServerOptions['logger']),
  }).withTypeProvider<ZodTypeProvider>();

  // Make zod the validator/serializer for the whole instance: one schema per
  // contract validates at runtime and types at compile time.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // ---------------------------------------------------------------------------
  // Cross-cutting plugins, registered BEFORE any route so their hooks apply:
  //   1. error-handler  — must be set first so every later failure (including
  //      ones thrown during plugin/route registration) maps to the envelope.
  //   2. auth           — @fastify/jwt + the global onRequest hook that enforces
  //      auth on every route except those flagged `{ public: true }`.
  //   3. rate-limit     — @fastify/rate-limit (global:false); only routes
  //      carrying `authRateLimit` are throttled (login/register).
  //
  // Still pending in later stories:
  //   H1.x  swagger + swagger-ui  (contract documentation from openapi.yaml)
  //   H4.1  farm-scope plugin     (ownership scoping for /farms/:farmId/*)
  //   H4.x  domain routes         (farms, fields, stables, machinery, configs, catalog)
  // ---------------------------------------------------------------------------

  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  await app.register(rateLimitPlugin);

  // Routes. health is public (config set on the route); auth routes mount the
  // /auth/* contract under the API prefix.
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });

  return app;
}
