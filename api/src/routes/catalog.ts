/**
 * Catalog routes (H4.1) — mounted by app.ts at `/api/v1/catalog`.
 *
 * Wires the read-only `/catalog/*` contract from docs/openapi.yaml to the
 * catalog controller:
 *   - GET /game-versions   list every game version
 *   - GET /crops           crops of a version (default active); meta.gameVersionId
 *   - GET /silage-crops    silage crops of a version (incl. cropSlug)
 *   - GET /animal-types    animal types with rates + feed options
 *   - GET /constants       flattened global balance constants
 *
 * All catalog routes REQUIRE authentication (catalog:read:public — "public" here
 * means "any authenticated user", not anonymous; docs/autorizacion-api.md). They
 * therefore carry NO `{ public: true }` flag, so the global auth onRequest hook
 * (src/plugins/auth.ts) enforces a valid access token.
 *
 * Every route declares its zod query/response schemas so fastify-type-provider
 * -zod validates the `?gameVersionId` query (→ 422 VALIDATION_ERROR) and
 * documents + serializes the response. The 200 bodies are sent by the controller
 * (it also emits ETag / Cache-Control and 304s conditional requests), and the
 * declared response schemas describe those 200 shapes.
 */

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import * as catalogController from '../controllers/catalog.controller';
import {
  gameVersionQuery,
  gameVersionsResponse,
  cropsResponse,
  silageCropsResponse,
  animalTypesResponse,
  constantsResponse,
  productionBuildingTypesResponse,
  productionProductsResponse,
  productionChainsResponse,
} from '../schemas/catalogResponse';

const catalogRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/game-versions',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Listar versiones de juego',
        response: { 200: gameVersionsResponse },
      },
    },
    catalogController.listGameVersions,
  );

  app.get(
    '/crops',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Catálogo de cultivos',
        querystring: gameVersionQuery,
        response: { 200: cropsResponse },
      },
    },
    catalogController.listCrops,
  );

  app.get(
    '/silage-crops',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Catálogo de cultivos de ensilaje',
        querystring: gameVersionQuery,
        response: { 200: silageCropsResponse },
      },
    },
    catalogController.listSilageCrops,
  );

  app.get(
    '/animal-types',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Catálogo de tipos de animales',
        querystring: gameVersionQuery,
        response: { 200: animalTypesResponse },
      },
    },
    catalogController.listAnimalTypes,
  );

  app.get(
    '/constants',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Constantes globales de balance',
        querystring: gameVersionQuery,
        response: { 200: constantsResponse },
      },
    },
    catalogController.getConstants,
  );

  app.get(
    '/production-building-types',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Tipos de edificios de producción',
        querystring: gameVersionQuery,
        response: { 200: productionBuildingTypesResponse },
      },
    },
    catalogController.listProductionBuildingTypes,
  );

  app.get(
    '/production-products',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Productos de fabricación (no cultivos)',
        querystring: gameVersionQuery,
        response: { 200: productionProductsResponse },
      },
    },
    catalogController.listProductionProducts,
  );

  app.get(
    '/production-chains',
    {
      schema: {
        tags: ['Catalog'],
        summary: 'Catálogo de cadenas de producción (recetas)',
        querystring: gameVersionQuery,
        response: { 200: productionChainsResponse },
      },
    },
    catalogController.listProductionChains,
  );
};

export default catalogRoutes;
