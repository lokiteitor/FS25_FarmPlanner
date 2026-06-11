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
import swaggerPlugin from './plugins/swagger';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import catalogRoutes from './routes/catalog';
import farmsRoutes from './routes/farms';
import userSettingsRoutes from './routes/userSettings';

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
  //   4. swagger        — @fastify/swagger + swagger-ui (H4.1). Registered
  //      BEFORE the routes so its onRoute hook captures every route's zod schema
  //      into the OpenAPI document. The docs UI lives at /api/v1/docs and is
  //      public (auth plugin skips that subtree).
  //
  // ---------------------------------------------------------------------------

  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  await app.register(rateLimitPlugin);
  await app.register(swaggerPlugin);

  // Routes. health is public (config set on the route); auth routes mount the
  // /auth/* contract. The remaining subtrees REQUIRE auth (enforced by the
  // global auth onRequest hook; only health, /auth/* and /api/v1/docs are
  // public):
  //   - catalog  read-only /catalog/* catalog reads
  //   - farms    /farms CRUD + the nested resource subtree
  //              (/farms/:farmId/{fields,stables,machinery,animal-configs,
  //               calculator-states}), with the farm-scope hook applied inside
  //               the farms plugin so request.farm is resolved before nested
  //               handlers run.
  //   - me/settings  the authenticated user's UI preferences.
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(catalogRoutes, { prefix: '/api/v1/catalog' });
  await app.register(farmsRoutes, { prefix: '/api/v1/farms' });
  await app.register(userSettingsRoutes, { prefix: '/api/v1/me/settings' });

  return app;
}
