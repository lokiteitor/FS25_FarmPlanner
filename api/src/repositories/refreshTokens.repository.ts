import { and, eq, isNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db, type DbExecutor } from '../db/client';
import { refreshTokens } from '../db/schema';

/**
 * Data access for the `refresh_tokens` table: opaque-token sessions with
 * rotation and reuse detection (docs/base-de-datos.md §2, docs/arquitectura-api
 * §9). Only the SHA-256 hash of the token is ever stored; the plaintext token
 * never reaches the database.
 *
 * Rotation rules implemented here (the service orchestrates them):
 *  - on /auth/refresh: the used token is marked rotated (replaced_by_id + a
 *    revoked_at timestamp) and a new token is created;
 *  - if a rotated/revoked token is presented again → reuse: revoke every active
 *    token of the user (the service then returns 401 REFRESH_TOKEN_REUSED).
 */

export type RefreshTokenRow = typeof refreshTokens.$inferSelect;

export interface CreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string | null;
  ip?: string | null;
}

/** Insert a new refresh-token row and return it. */
export async function create(
  input: CreateRefreshTokenInput,
  tx: DbExecutor = db,
): Promise<RefreshTokenRow> {
  const [row] = await tx
    .insert(refreshTokens)
    .values({
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      userAgent: input.userAgent ?? null,
      ip: input.ip ?? null,
    })
    .returning();
  return row;
}

/**
 * Look up a token by its SHA-256 hash. The caller inspects `revokedAt`,
 * `replacedById` and `expiresAt` to decide validity vs. reuse.
 */
export async function findByHash(
  tokenHash: string,
  tx: DbExecutor = db,
): Promise<RefreshTokenRow | undefined> {
  const rows = await tx
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);
  return rows[0];
}

/**
 * Mark a token as rotated: record the token that replaced it and stamp
 * `revoked_at = now()`. Used on every successful /auth/refresh.
 */
export async function markRotated(
  id: string,
  replacedById: string,
  tx: DbExecutor = db,
): Promise<RefreshTokenRow | undefined> {
  const [row] = await tx
    .update(refreshTokens)
    .set({ replacedById, revokedAt: sql`now()` })
    .where(eq(refreshTokens.id, id))
    .returning();
  return row;
}

/**
 * Revoke a single token (logout). Idempotent: only stamps `revoked_at` if it is
 * still null, so a second logout with the same token is a no-op.
 */
export async function revoke(
  id: string,
  tx: DbExecutor = db,
): Promise<RefreshTokenRow | undefined> {
  const [row] = await tx
    .update(refreshTokens)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)))
    .returning();
  return row;
}

/**
 * Revoke every still-active token for a user (reuse detected → kill the whole
 * session family). Returns the rows that were revoked by this call.
 */
export async function revokeAllActiveForUser(
  userId: string,
  tx: DbExecutor = db,
): Promise<RefreshTokenRow[]> {
  return tx
    .update(refreshTokens)
    .set({ revokedAt: sql`now()` })
    .where(
      and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)),
    )
    .returning();
}
