/**
 * Swagger / OpenAPI documentation plugin (H4.1).
 *
 * Exposes the contract as live, browsable docs derived from the zod route
 * schemas (docs/arquitectura-api.md §6.1: one schema validates at runtime and
 * documents the API). Two pieces:
 *   1. @fastify/swagger (openapi 3.1) — builds the OpenAPI document. The
 *      `transform` is fastify-type-provider-zod's `jsonSchemaTransform`, which
 *      converts each route's zod request/response schemas into JSON Schema so
 *      they appear in the spec.
 *   2. @fastify/swagger-ui — serves the Swagger UI (and the generated
 *      openapi.json) under `/api/v1/docs`.
 *
 * PUBLIC ACCESS: the docs UI and the OpenAPI JSON must be reachable without a
 * token. The swagger-ui routes don't carry our `{ public: true }` route config,
 * so the global auth onRequest hook (src/plugins/auth.ts) would otherwise gate
 * them. That hook is therefore taught to skip any URL under `/api/v1/docs`
 * (see the comment + check in auth.ts).
 */

import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

/** Mount point for the Swagger UI + generated openapi.json. */
export const DOCS_ROUTE_PREFIX = '/api/v1/docs';

/**
 * Documented API version. Kept in sync with package.json `version` by hand:
 * package.json sits outside tsconfig's `rootDir` ("src"), so importing it would
 * break the build's output layout — a one-line constant is the pragmatic trade.
 */
const API_VERSION = '0.1.0';

async function swaggerPlugin(
  app: import('fastify').FastifyInstance,
): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'FS25 Farm Planner API',
        description:
          'Documentación viva del contrato, generada desde los schemas zod de las rutas. ' +
          'Fuente de verdad del contrato: docs/openapi.yaml.',
        version: API_VERSION,
        contact: { name: 'Equipo FS25 Tools' },
      },
      servers: [
        { url: '/api/v1', description: 'Backend tras el proxy nginx' },
      ],
      // Default security scheme: JWT bearer. Routes flagged public (auth/*,
      // health) override this with their own (empty) security in later wiring.
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    // Turn the zod route schemas into JSON Schema for the spec.
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: DOCS_ROUTE_PREFIX,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });
}

export default fp(swaggerPlugin, {
  name: 'swagger',
  fastify: '5.x',
});
