/**
 * Auth routes (H3.3) — mounted by app.ts at `/api/v1/auth`.
 *
 * Wires the `/auth/*` contract from docs/openapi.yaml to the controller:
 *  - `register`, `login`, `refresh`, `logout` are `{ public: true }` so the
 *    global auth onRequest hook (src/plugins/auth.ts) skips them. logout still
 *    needs no access token — it operates purely on the supplied refresh token.
 *  - `login` and `register` additionally carry {@link authRateLimit} so abusive
 *    credential stuffing is throttled (docs/arquitectura-api.md §9).
 *  - `me` (GET/PATCH) is protected by the global hook (no `public` flag).
 *
 * Every route declares its zod body + response schemas so fastify-type-provider
 * -zod runs validation (→ 422 VALIDATION_ERROR) and response serialisation.
 */

import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { authRateLimit } from '../plugins/rate-limit';
import * as authController from '../controllers/auth.controller';
import {
  registerBody,
  loginBody,
  refreshBody,
  logoutBody,
  updateMeBody,
  authSessionResponse,
  tokenPairResponse,
  userResponse,
} from '../schemas/auth';

const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/register',
    {
      config: { public: true, ...authRateLimit },
      schema: {
        tags: ['Auth'],
        summary: 'Registrar una cuenta',
        body: registerBody,
        response: { 201: authSessionResponse },
      },
    },
    authController.register,
  );

  app.post(
    '/login',
    {
      config: { public: true, ...authRateLimit },
      schema: {
        tags: ['Auth'],
        summary: 'Iniciar sesión',
        body: loginBody,
        response: { 200: authSessionResponse },
      },
    },
    authController.login,
  );

  app.post(
    '/refresh',
    {
      config: { public: true },
      schema: {
        tags: ['Auth'],
        summary: 'Rotar tokens',
        body: refreshBody,
        response: { 200: tokenPairResponse },
      },
    },
    authController.refresh,
  );

  app.post(
    '/logout',
    {
      config: { public: true },
      schema: {
        tags: ['Auth'],
        summary: 'Revocar el refresh token actual',
        body: logoutBody,
        response: { 204: z.null() },
      },
    },
    authController.logout,
  );

  app.get(
    '/me',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Usuario autenticado',
        response: { 200: userResponse },
      },
    },
    authController.getMe,
  );

  app.patch(
    '/me',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Actualizar perfil o contraseña',
        body: updateMeBody,
        response: { 200: userResponse },
      },
    },
    authController.updateMe,
  );
};

export default authRoutes;
