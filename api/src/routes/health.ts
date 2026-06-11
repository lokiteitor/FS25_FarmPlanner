import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

/**
 * Health route — public, no auth.
 * Used by docker-compose / nginx healthchecks: GET /api/v1/health.
 */
const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        summary: 'Liveness/health probe',
        response: {
          200: z.object({
            data: z.object({
              status: z.literal('ok'),
              uptime: z.number(),
            }),
          }),
        },
      },
    },
    async () => {
      return {
        data: {
          status: 'ok' as const,
          uptime: process.uptime(),
        },
      };
    },
  );
};

export default healthRoutes;
