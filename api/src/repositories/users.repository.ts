import { eq } from 'drizzle-orm';
import { db, type DbExecutor } from '../db/client';
import { users } from '../db/schema';

/**
 * Data access for the `users` table. Per the layered architecture, ALL queries
 * against `users` live here; services/controllers never touch the db directly.
 *
 * Every function takes an optional executor (`tx`, defaulting to the shared
 * `db`) so it can be composed inside a `db.transaction(...)` — the register flow
 * creates the user, its user_settings row and a default farm atomically.
 */

/** A full `users` row as returned by Drizzle (includes passwordHash). */
export type UserRow = typeof users.$inferSelect;

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName?: string | null;
}

/**
 * Find a user by email. Email is `citext`, so the comparison is
 * case-insensitive at the database level (no need to lower-case here).
 */
export async function findByEmail(
  email: string,
  tx: DbExecutor = db,
): Promise<UserRow | undefined> {
  const rows = await tx
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return rows[0];
}

/** Find a user by id. */
export async function findById(
  id: string,
  tx: DbExecutor = db,
): Promise<UserRow | undefined> {
  const rows = await tx.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}

/**
 * Insert a new user and return the created row. The unique constraint on
 * `email` is what enforces "email already registered"; the service maps the
 * resulting db error to `409 EMAIL_ALREADY_REGISTERED`.
 */
export async function create(
  input: CreateUserInput,
  tx: DbExecutor = db,
): Promise<UserRow> {
  const [row] = await tx
    .insert(users)
    .values({
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName ?? null,
    })
    .returning();
  return row;
}

/**
 * Update mutable profile fields. Only `displayName` is editable here (email is
 * immutable in v1). Returns the updated row, or undefined if the id is unknown.
 */
export async function updateProfile(
  id: string,
  patch: { displayName?: string | null },
  tx: DbExecutor = db,
): Promise<UserRow | undefined> {
  const [row] = await tx
    .update(users)
    .set({ displayName: patch.displayName })
    .where(eq(users.id, id))
    .returning();
  return row;
}

/**
 * Replace the password hash for a user (used by the change-password flow after
 * the current password has been verified). Returns the updated row.
 */
export async function updatePasswordHash(
  id: string,
  passwordHash: string,
  tx: DbExecutor = db,
): Promise<UserRow | undefined> {
  const [row] = await tx
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, id))
    .returning();
  return row;
}
