import { eq } from 'drizzle-orm';
import { db, type DbExecutor } from '../db/client';
import { userSettings } from '../db/schema';

/**
 * Data access for the `user_settings` table (1:1 with users; PK = user_id).
 *
 * All functions take an optional executor (`tx`, defaulting to `db`) so the row
 * can be created inside the register transaction alongside the user and the
 * default farm.
 */

export type UserSettingsRow = typeof userSettings.$inferSelect;

/**
 * Defaults for a fresh user_settings row. Matches the column defaults in
 * docs/base-de-datos.md §3 (locale 'es', theme 'system', preferences {}).
 * The active farm is set later, after the default farm is created.
 */
export interface UserSettingsDefaults {
  locale?: string;
  theme?: string;
  preferences?: Record<string, unknown>;
  activeFarmId?: string | null;
}

/**
 * Insert the settings row for a user. Called at registration (and by
 * `GET /me/settings` if the row is somehow missing). Returns the created row.
 */
export async function create(
  userId: string,
  defaults: UserSettingsDefaults = {},
  tx: DbExecutor = db,
): Promise<UserSettingsRow> {
  const [row] = await tx
    .insert(userSettings)
    .values({
      userId,
      locale: defaults.locale ?? 'es',
      theme: defaults.theme ?? 'system',
      preferences: defaults.preferences ?? {},
      activeFarmId: defaults.activeFarmId ?? null,
    })
    .returning();
  return row;
}

/** Fetch the settings row for a user, if it exists. */
export async function getByUserId(
  userId: string,
  tx: DbExecutor = db,
): Promise<UserSettingsRow | undefined> {
  const rows = await tx
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return rows[0];
}

/**
 * Set (or clear) the active farm for a user. Ownership of `farmId` is validated
 * in the service layer (422 FARM_NOT_OWNED), not here.
 */
export async function setActiveFarm(
  userId: string,
  farmId: string | null,
  tx: DbExecutor = db,
): Promise<UserSettingsRow | undefined> {
  const [row] = await tx
    .update(userSettings)
    .set({ activeFarmId: farmId })
    .where(eq(userSettings.userId, userId))
    .returning();
  return row;
}

/**
 * Patch arbitrary settings fields. Only the provided keys are written, so an
 * absent key leaves its column untouched. Returns the updated row.
 */
export async function update(
  userId: string,
  patch: {
    locale?: string;
    theme?: string;
    activeFarmId?: string | null;
    preferences?: Record<string, unknown>;
  },
  tx: DbExecutor = db,
): Promise<UserSettingsRow | undefined> {
  const [row] = await tx
    .update(userSettings)
    .set(patch)
    .where(eq(userSettings.userId, userId))
    .returning();
  return row;
}
