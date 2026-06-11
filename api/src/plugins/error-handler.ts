/**
 * Centralised error-handling plugin (H3.1).
 *
 * Single place that converts every failure into the project error envelope
 * `{ error: { code, message, details? } }` (`docs/arquitectura-api.md` §8/§10).
 *
 * Resolution order in {@link errorHandler}:
 *   1. zod request-validation failures (from fastify-type-provider-zod)
 *      -> 422 VALIDATION_ERROR with `details` from each issue.
 *   2. A raw `ZodError` thrown anywhere -> same 422 VALIDATION_ERROR.
 *   3. `@fastify/jwt` errors -> 401 (TOKEN_EXPIRED on expiry, else UNAUTHORIZED).
 *   4. `@fastify/rate-limit` 429 -> 429 RATE_LIMITED (fallback; the rate-limit
 *      plugin's errorResponseBuilder normally handles this first).
 *   5. Domain {@link AppError} -> its own statusCode/code/message/details.
 *   6. Plain Fastify validation errors (non-zod) -> 422 VALIDATION_ERROR.
 *   7. Anything else -> log full error, respond 500 INTERNAL_ERROR (no internals).
 *
 * `setNotFoundHandler` answers unmatched routes with 404 NOT_FOUND.
 */

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError, type ZodIssue } from 'zod';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

import { errorBody } from '../lib/envelope';
import { isAppError, type ErrorDetail } from '../lib/errors';

const JWT_EXPIRED_CODE = 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED';

/** PostgreSQL SQLSTATE for unique_violation. */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * Map a DB unique-constraint name to the stable API error code/message. This is
 * the race-safe backstop for duplicate detection (a concurrent insert that slips
 * past a service-level pre-check still yields the correct 409, not a 500), and is
 * reused by every domain resource in H4.
 */
const UNIQUE_CONSTRAINT_ERRORS: Record<
  string,
  { code: string; message: string }
> = {
  users_email_unique: {
    code: 'EMAIL_ALREADY_REGISTERED',
    message: 'Ese email ya está registrado',
  },
  farms_user_name_unique: {
    code: 'DUPLICATE_FARM_NAME',
    message: 'Ya tienes una partida con ese nombre',
  },
  fields_farm_number_unique: {
    code: 'DUPLICATE_FIELD_NUMBER',
    message: 'Número de campo duplicado en la partida',
  },
  stables_farm_name_unique: {
    code: 'DUPLICATE_STABLE_NAME',
    message: 'Nombre de establo duplicado en la partida',
  },
};

/** Read the `constraint_name` off a postgres-js error, if present. */
function constraintName(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'constraint_name' in err) {
    const name = (err as { constraint_name?: unknown }).constraint_name;
    return typeof name === 'string' ? name : undefined;
  }
  return undefined;
}

/** Map a single zod issue to an envelope detail. */
function issueToDetail(issue: ZodIssue): ErrorDetail {
  return {
    path: issue.path.join('.'),
    message: issue.message,
  };
}

/** Read a `code` string off an unknown error, if present. */
function errorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  // 1. zod validation errors surfaced by fastify-type-provider-zod.
  if (hasZodFastifySchemaValidationErrors(error)) {
    const details = error.validation.map((v) => issueToDetail(v.params.issue));
    return reply
      .status(422)
      .send(errorBody('VALIDATION_ERROR', 'Validation failed', details));
  }

  // 2. A raw ZodError thrown outside the validation pipeline.
  if (error instanceof ZodError) {
    const details = error.issues.map(issueToDetail);
    return reply
      .status(422)
      .send(errorBody('VALIDATION_ERROR', 'Validation failed', details));
  }

  const code = errorCode(error);

  // 3. @fastify/jwt authentication errors (covers any path that bypassed the
  //    auth plugin's own AppError translation).
  if (code && code.startsWith('FST_JWT_')) {
    if (code === JWT_EXPIRED_CODE) {
      return reply
        .status(401)
        .send(errorBody('TOKEN_EXPIRED', 'Access token expired'));
    }
    return reply
      .status(401)
      .send(errorBody('UNAUTHORIZED', 'Authentication required'));
  }

  // 4. @fastify/rate-limit fallback (normally handled by errorResponseBuilder).
  if (error.statusCode === 429) {
    return reply
      .status(429)
      .send(
        errorBody('RATE_LIMITED', 'Demasiados intentos, reintenta más tarde'),
      );
  }

  // 5. Deliberate domain errors carry their own status/code/message/details.
  if (isAppError(error)) {
    return reply
      .status(error.statusCode)
      .send(errorBody(error.code, error.message, error.details));
  }

  // 5b. PostgreSQL unique-constraint violations -> 409 with the stable code
  //     (race-safe duplicate backstop; reused by all domain resources).
  if (code === PG_UNIQUE_VIOLATION) {
    const mapped = UNIQUE_CONSTRAINT_ERRORS[constraintName(error) ?? ''];
    if (mapped) {
      return reply.status(409).send(errorBody(mapped.code, mapped.message));
    }
    return reply
      .status(409)
      .send(errorBody('DUPLICATE_RESOURCE', 'Resource already exists'));
  }

  // 6. Plain Fastify validation errors (e.g. content-type/body parsing) that are
  //    not zod-shaped.
  if (error.validation) {
    const details: ErrorDetail[] = error.validation.map((v) => ({
      path:
        typeof v.instancePath === 'string'
          ? v.instancePath.replace(/^\//, '').replace(/\//g, '.')
          : undefined,
      message: v.message ?? 'Invalid value',
    }));
    return reply
      .status(422)
      .send(errorBody('VALIDATION_ERROR', 'Validation failed', details));
  }

  // 7. Unexpected failure: log everything server-side, leak nothing to client.
  request.log.error(
    { err: error, reqId: request.id },
    'Unhandled error while processing request',
  );
  return reply
    .status(500)
    .send(errorBody('INTERNAL_ERROR', 'Internal server error'));
}

async function errorHandlerPlugin(
  app: import('fastify').FastifyInstance,
): Promise<void> {
  app.setErrorHandler(errorHandler);

  app.setNotFoundHandler((request, reply) => {
    request.log.info({ reqId: request.id, url: request.url }, 'Route not found');
    return reply
      .status(404)
      .send(errorBody('NOT_FOUND', 'Resource not found'));
  });
}

export default fp(errorHandlerPlugin, {
  name: 'error-handler',
  fastify: '5.x',
});
