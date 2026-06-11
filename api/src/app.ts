import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import { env } from './config/env';
import healthRoutes from './routes/health';

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
  // Cross-cutting plugins and domain routes are registered here in later stories:
  //   H3.1  error-handler plugin  (zod -> 422 VALIDATION_ERROR, domain errors, 500)
  //   H3.1  auth plugin           (@fastify/jwt, request.user, whitelist)
  //   H3.4  rate-limit plugin     (@fastify/rate-limit on /auth/login, /auth/register)
  //   H1.x  swagger + swagger-ui  (contract documentation from openapi.yaml)
  //   H4.1  farm-scope plugin     (ownership scoping for /farms/:farmId/*)
  //   H3.x  auth routes           (register, login, refresh, logout, me)
  //   H4.x  domain routes         (farms, fields, stables, machinery, configs, catalog)
  // For now only the public health route is wired so the scaffold compiles and boots.
  // ---------------------------------------------------------------------------

  await app.register(healthRoutes, { prefix: '/api/v1' });

  return app;
}
