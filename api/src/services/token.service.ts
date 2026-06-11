/**
 * Token service (H3.2).
 *
 * Pure crypto/token helpers shared by the auth and session services. It has no
 * knowledge of the request/response cycle and never touches the database:
 *
 *  - access tokens: short-lived JWTs signed by `@fastify/jwt` (the signing
 *    secret and `expiresIn` live in the auth plugin; see src/plugins/auth.ts).
 *  - refresh tokens: opaque 32-byte random strings. Only their SHA-256 hash is
 *    ever persisted (docs/base-de-datos.md §2) — the plaintext is returned to
 *    the client once and never stored.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

import { env } from '../config/env';

/** Validity window (seconds) of an access token; mirrors the JWT `expiresIn`. */
export const expiresIn = env.ACCESS_TOKEN_TTL;

/** Number of random bytes behind an opaque refresh token. */
const REFRESH_TOKEN_BYTES = 32;

/** Milliseconds in a day, used to compute the refresh expiry. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Minimal user shape needed to sign an access token. */
export interface AccessTokenUser {
  id: string;
  email: string;
}

/**
 * Sign an access token for a user. The payload `{ sub, email }` matches the
 * `FastifyJWT.payload` augmentation (src/types/fastify.d.ts); `expiresIn` is
 * taken from the plugin's sign config, so we don't pass it here.
 */
export function issueAccessToken(
  app: FastifyInstance,
  user: AccessTokenUser,
): string {
  return app.jwt.sign({ sub: user.id, email: user.email });
}

/** SHA-256 hex digest of an opaque refresh token. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a fresh opaque refresh token and its storable hash.
 *
 * `token` (base64url of 32 random bytes) is the value handed to the client;
 * `tokenHash` (SHA-256 hex) is what gets persisted.
 */
export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashRefreshToken(token) };
}

/** Absolute expiry (now + REFRESH_TOKEN_TTL_DAYS) for a new refresh token. */
export function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * MS_PER_DAY);
}
