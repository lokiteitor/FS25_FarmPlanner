/**
 * Session service (H3.2): refresh-token rotation, reuse detection and logout.
 *
 * Implements the rotation rules from docs/base-de-datos.md §2:
 *  - every `/auth/refresh` rotates: the presented token is marked rotated
 *    (`replaced_by_id` + `revoked_at`) and a brand-new token is issued;
 *  - presenting an already-rotated/revoked token is a REUSE signal → the whole
 *    active token family of that user is revoked and we answer
 *    `401 REFRESH_TOKEN_REUSED`;
 *  - an expired-but-unused token is revoked and answered `401
 *    INVALID_REFRESH_TOKEN`.
 *
 * Logout is idempotent: it revokes the matching token if still active and never
 * errors, so a client can safely call it even with an already-dead token.
 */

import type { FastifyInstance } from 'fastify';

import { db } from '../db/client';
import { UnauthorizedError } from '../lib/errors';
import * as usersRepo from '../repositories/users.repository';
import * as refreshTokensRepo from '../repositories/refreshTokens.repository';
import type { RequestMeta } from './auth.service';
import {
  expiresIn,
  generateRefreshToken,
  hashRefreshToken,
  issueAccessToken,
  refreshExpiry,
} from './token.service';

/** A freshly rotated access/refresh pair (no user payload). */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Rotate a refresh token, detecting reuse.
 *
 * On the happy path the rotation (revoke old + link replacement + create new)
 * runs inside a single transaction so the chain can never end up half-updated.
 */
export async function refresh(
  app: FastifyInstance,
  refreshToken: string,
  meta: RequestMeta,
): Promise<TokenPair> {
  const tokenHash = hashRefreshToken(refreshToken);
  const row = await refreshTokensRepo.findByHash(tokenHash);

  if (!row) {
    throw new UnauthorizedError(
      'INVALID_REFRESH_TOKEN',
      'Token inválido o expirado',
    );
  }

  // Already rotated or revoked → reuse: kill the whole session family.
  if (row.revokedAt !== null || row.replacedById !== null) {
    await refreshTokensRepo.revokeAllActiveForUser(row.userId);
    throw new UnauthorizedError(
      'REFRESH_TOKEN_REUSED',
      'Reuso detectado; sesión revocada',
    );
  }

  // Expired-but-unused: revoke and reject.
  if (row.expiresAt.getTime() < Date.now()) {
    await refreshTokensRepo.revoke(row.id);
    throw new UnauthorizedError(
      'INVALID_REFRESH_TOKEN',
      'Token inválido o expirado',
    );
  }

  const user = await usersRepo.findById(row.userId);
  if (!user) {
    // The owning user vanished (e.g. account deleted): treat as invalid.
    throw new UnauthorizedError(
      'INVALID_REFRESH_TOKEN',
      'Token inválido o expirado',
    );
  }

  const { token: newToken, tokenHash: newHash } = generateRefreshToken();

  await db.transaction(async (tx) => {
    const newRow = await refreshTokensRepo.create(
      {
        userId: row.userId,
        tokenHash: newHash,
        expiresAt: refreshExpiry(),
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
      },
      tx,
    );
    await refreshTokensRepo.markRotated(row.id, newRow.id, tx);
  });

  const accessToken = issueAccessToken(app, user);

  return {
    accessToken,
    refreshToken: newToken,
    expiresIn,
  };
}

/**
 * Revoke the refresh token behind a session (logout). Idempotent: unknown or
 * already-revoked tokens are a silent no-op so the endpoint always succeeds.
 */
export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(refreshToken);
  const row = await refreshTokensRepo.findByHash(tokenHash);
  if (row && row.revokedAt === null) {
    await refreshTokensRepo.revoke(row.id);
  }
}
