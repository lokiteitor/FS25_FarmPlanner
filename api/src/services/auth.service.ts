/**
 * Auth service (H3.2): registration, login and the authenticated profile
 * (`/auth/me`) operations.
 *
 * Responsibilities and boundaries:
 *  - Orchestrates repositories + the token service; ALL DB access goes through
 *    repositories (layered architecture), never raw queries here.
 *  - Passwords are hashed with argon2id (docs/arquitectura-api.md §9).
 *  - Throws domain {@link AppError}s; the error-handler plugin turns them into
 *    the standard envelope. Login uses one opaque `INVALID_CREDENTIALS` for both
 *    "no such email" and "wrong password" so existence isn't leaked.
 *
 * The public `User` shape returned to clients (`{ id, email, displayName,
 * createdAt }`) is produced by {@link toPublicUser}; `passwordHash` and other
 * internal columns never cross this boundary.
 */

import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';

import { db } from '../db/client';
import { ConflictError, NotFoundError, UnauthorizedError } from '../lib/errors';
import * as usersRepo from '../repositories/users.repository';
import type { UserRow } from '../repositories/users.repository';
import * as userSettingsRepo from '../repositories/userSettings.repository';
import * as farmsRepo from '../repositories/farms.repository';
import * as refreshTokensRepo from '../repositories/refreshTokens.repository';
import type { RegisterInput, LoginInput, UpdateMeInput } from '../schemas/auth';
import {
  expiresIn,
  generateRefreshToken,
  issueAccessToken,
  refreshExpiry,
} from './token.service';

/** Argon2id options (memory/time cost left to library defaults in v1). */
const ARGON2_OPTIONS = { type: argon2.argon2id } as const;

/**
 * Cached dummy argon2id hash used to equalise login timing when the email is
 * unknown: we always run one verify so an attacker can't distinguish
 * "no such user" (fast) from "wrong password" (slow argon2) and enumerate
 * accounts via response time.
 */
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash('timing-equalizer-not-a-real-secret', ARGON2_OPTIONS);
  }
  return dummyHashPromise;
}

/** Public, client-facing representation of a user. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

/** Session payload returned by register/login: user + freshly issued tokens. */
export interface AuthSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Request-derived context stored alongside a refresh token for auditing. */
export interface RequestMeta {
  userAgent?: string | null;
  ip?: string | null;
}

/** Strip internal columns; serialise `createdAt` to an ISO string. */
function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Register a new account atomically: user + user_settings + default farm, with
 * the default farm set active, plus the first access/refresh token pair.
 *
 * The whole flow runs in one transaction so a partial account can never exist.
 * A pre-check on the email yields a clean `409 EMAIL_ALREADY_REGISTERED`; the
 * unique constraint is the ultimate backstop against the race.
 */
export async function register(
  app: FastifyInstance,
  input: RegisterInput,
  meta: RequestMeta,
): Promise<AuthSession> {
  const session = await db.transaction(async (tx) => {
    const existing = await usersRepo.findByEmail(input.email, tx);
    if (existing) {
      throw new ConflictError(
        'EMAIL_ALREADY_REGISTERED',
        'Ese email ya está registrado',
      );
    }

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

    const user = await usersRepo.create(
      {
        email: input.email,
        passwordHash,
        displayName: input.displayName ?? null,
      },
      tx,
    );

    await userSettingsRepo.create(user.id, {}, tx);

    const gameVersionId = await farmsRepo.getActiveGameVersionId(tx);
    const farm = await farmsRepo.createDefault(
      { userId: user.id, gameVersionId },
      tx,
    );
    await userSettingsRepo.setActiveFarm(user.id, farm.id, tx);

    const accessToken = issueAccessToken(app, user);
    const { token: refreshToken, tokenHash } = generateRefreshToken();
    await refreshTokensRepo.create(
      {
        userId: user.id,
        tokenHash,
        expiresAt: refreshExpiry(),
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
      },
      tx,
    );

    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
      expiresIn,
    };
  });

  return session;
}

/**
 * Authenticate by email + password and start a session.
 *
 * Both "unknown email" and "bad password" collapse to a single
 * `401 INVALID_CREDENTIALS` so the response can't be used to enumerate accounts.
 */
export async function login(
  app: FastifyInstance,
  input: LoginInput,
  meta: RequestMeta,
): Promise<AuthSession> {
  const user = await usersRepo.findByEmail(input.email);
  if (!user) {
    // Run a verify against a dummy hash anyway so the response time matches the
    // "user exists, wrong password" path (prevents timing-based enumeration).
    await argon2.verify(await getDummyHash(), input.password).catch(() => false);
    throw new UnauthorizedError(
      'INVALID_CREDENTIALS',
      'Email o contraseña incorrectos',
    );
  }

  const valid = await argon2.verify(user.passwordHash, input.password);
  if (!valid) {
    throw new UnauthorizedError(
      'INVALID_CREDENTIALS',
      'Email o contraseña incorrectos',
    );
  }

  const accessToken = issueAccessToken(app, user);
  const { token: refreshToken, tokenHash } = generateRefreshToken();
  await refreshTokensRepo.create({
    userId: user.id,
    tokenHash,
    expiresAt: refreshExpiry(),
    userAgent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
  });

  return {
    user: toPublicUser(user),
    accessToken,
    refreshToken,
    expiresIn,
  };
}

/** Fetch the authenticated user's public profile. */
export async function getMe(userId: string): Promise<PublicUser> {
  const user = await usersRepo.findById(userId);
  if (!user) {
    throw new NotFoundError('USER_NOT_FOUND', 'Usuario no encontrado');
  }
  return toPublicUser(user);
}

/**
 * Update the authenticated user's profile and/or password.
 *
 * Changing the password requires the current one to verify (the schema already
 * enforces that `newPassword` implies `currentPassword`); a wrong current
 * password is `401 INVALID_CREDENTIALS`. `displayName` is updated independently.
 */
export async function updateMe(
  userId: string,
  body: UpdateMeInput,
): Promise<PublicUser> {
  const user = await usersRepo.findById(userId);
  if (!user) {
    throw new NotFoundError('USER_NOT_FOUND', 'Usuario no encontrado');
  }

  let current = user;

  if (body.newPassword !== undefined) {
    const valid = await argon2.verify(
      user.passwordHash,
      body.currentPassword ?? '',
    );
    if (!valid) {
      throw new UnauthorizedError(
        'INVALID_CREDENTIALS',
        'Contraseña actual incorrecta',
      );
    }
    const passwordHash = await argon2.hash(body.newPassword, ARGON2_OPTIONS);
    const updated = await usersRepo.updatePasswordHash(userId, passwordHash);
    if (updated) {
      current = updated;
    }
  }

  if (body.displayName !== undefined) {
    const updated = await usersRepo.updateProfile(userId, {
      displayName: body.displayName,
    });
    if (updated) {
      current = updated;
    }
  }

  return toPublicUser(current);
}
