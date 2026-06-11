/**
 * Auth controller (H3.3): thin HTTP adapters for the `/auth/*` routes.
 *
 * Controllers only translate between the request/response cycle and the service
 * layer: pull validated input off `request.body`, gather audit metadata
 * (user-agent + IP), pass `request.server` (the Fastify app) where a service
 * needs to sign a JWT, and wrap the result in the success envelope `{ data }`.
 * No business logic, no DB access, no error handling — domain errors bubble up
 * to the error-handler plugin.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import * as authService from '../services/auth.service';
import * as sessionService from '../services/session.service';
import type { RequestMeta } from '../services/auth.service';
import type {
  RegisterInput,
  LoginInput,
  RefreshInput,
  LogoutInput,
  UpdateMeInput,
} from '../schemas/auth';

/** Extract the audit metadata stored with refresh tokens. */
function requestMeta(request: FastifyRequest): RequestMeta {
  return {
    userAgent: request.headers['user-agent'] ?? null,
    ip: request.ip,
  };
}

/** POST /auth/register → 201 { data: AuthSession }. */
export async function register(
  request: FastifyRequest<{ Body: RegisterInput }>,
  reply: FastifyReply,
): Promise<void> {
  const session = await authService.register(
    request.server,
    request.body,
    requestMeta(request),
  );
  await reply.status(201).send({ data: session });
}

/** POST /auth/login → 200 { data: AuthSession }. */
export async function login(
  request: FastifyRequest<{ Body: LoginInput }>,
): Promise<{ data: authService.AuthSession }> {
  const session = await authService.login(
    request.server,
    request.body,
    requestMeta(request),
  );
  return { data: session };
}

/** POST /auth/refresh → 200 { data: TokenPair }. */
export async function refresh(
  request: FastifyRequest<{ Body: RefreshInput }>,
): Promise<{ data: sessionService.TokenPair }> {
  const tokens = await sessionService.refresh(
    request.server,
    request.body.refreshToken,
    requestMeta(request),
  );
  return { data: tokens };
}

/** POST /auth/logout → 204 (idempotent). */
export async function logout(
  request: FastifyRequest<{ Body: LogoutInput }>,
  reply: FastifyReply,
): Promise<void> {
  await sessionService.logout(request.body.refreshToken);
  await reply.status(204).send();
}

/** GET /auth/me → 200 { data: User }. */
export async function getMe(
  request: FastifyRequest,
): Promise<{ data: authService.PublicUser }> {
  const user = await authService.getMe(request.user.id);
  return { data: user };
}

/** PATCH /auth/me → 200 { data: User }. */
export async function updateMe(
  request: FastifyRequest<{ Body: UpdateMeInput }>,
): Promise<{ data: authService.PublicUser }> {
  const user = await authService.updateMe(request.user.id, request.body);
  return { data: user };
}
