/**
 * User Settings service (H4.6): the UI-preferences operations behind
 * `GET/PATCH /me/settings`.
 *
 * Responsibilities and boundaries:
 *  - Orchestrates the user-settings repository (and the farms repository for the
 *    active-farm ownership check); ALL DB access goes through repositories.
 *  - `getSettings` is read-with-lazy-create: the row is materialised with
 *    defaults if a user somehow lacks one (docs/base-de-datos.md §3).
 *  - `updateSettings` applies a partial patch. When `activeFarmId` is a non-null
 *    uuid, the farm must belong to the caller (farms.findOwned scopes by owner);
 *    otherwise → 422 FARM_NOT_OWNED (docs/autorizacion-api.md, business rule
 *    §3). An explicit null clears the active farm and skips the check.
 *
 * The public `UserSettings` shape returned to clients serialises the timestamp
 * columns to ISO strings via {@link toPublicSettings}; internal columns never
 * cross this boundary.
 */

import { UnprocessableError } from '../lib/errors';
import * as userSettingsRepo from '../repositories/userSettings.repository';
import type { UserSettingsRow } from '../repositories/userSettings.repository';
import * as farmsRepo from '../repositories/farms.repository';
import type {
  UserSettingsResponse,
  UserSettingsUpdateInput,
} from '../schemas/userSettings';

/**
 * Public, client-facing representation of a user's settings. Aliased to the
 * zod-inferred response type so the service output matches the route's
 * serialisation contract exactly (notably `theme` is the enum literal union,
 * not a bare string).
 */
export type PublicUserSettings = UserSettingsResponse;

/** UI themes the contract allows (narrows the varchar column to the enum). */
const THEMES = ['system', 'dark', 'light'] as const;
type Theme = (typeof THEMES)[number];

/** Narrow the stored `theme` string to the contract enum (fallback 'system'). */
function asTheme(theme: string): Theme {
  return (THEMES as readonly string[]).includes(theme)
    ? (theme as Theme)
    : 'system';
}

/** Map a user_settings row to the public DTO (timestamps → ISO strings). */
function toPublicSettings(row: UserSettingsRow): PublicUserSettings {
  return {
    userId: row.userId,
    locale: row.locale,
    theme: asTheme(row.theme),
    activeFarmId: row.activeFarmId ?? null,
    preferences: row.preferences ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Get the caller's settings, creating the row with defaults if it is missing
 * (`GET /me/settings`).
 */
export async function getSettings(
  userId: string,
): Promise<PublicUserSettings> {
  const row = await userSettingsRepo.getOrCreate(userId);
  return toPublicSettings(row);
}

/**
 * Apply a partial update to the caller's settings (`PATCH /me/settings`).
 *
 * Ensures the row exists first (so a patch never silently no-ops for a user
 * without settings). When `activeFarmId` is a non-null uuid, ownership is
 * verified against the farms repository (scoped by owner → a farm of another
 * user is simply not found) and rejected with 422 FARM_NOT_OWNED. An explicit
 * `null` clears the active farm. Only the keys present in `patch` are written.
 */
export async function updateSettings(
  userId: string,
  patch: UserSettingsUpdateInput,
): Promise<PublicUserSettings> {
  // Guarantee the row exists before patching (matches GET's lazy-create).
  await userSettingsRepo.getOrCreate(userId);

  if (patch.activeFarmId !== undefined && patch.activeFarmId !== null) {
    const owned = await farmsRepo.findOwned(patch.activeFarmId, userId);
    if (!owned) {
      throw new UnprocessableError(
        'FARM_NOT_OWNED',
        'La partida activa no pertenece al usuario',
      );
    }
  }

  // Nothing to write (empty patch) → return the current row unchanged.
  if (Object.keys(patch).length === 0) {
    return getSettings(userId);
  }

  const updated = await userSettingsRepo.update(userId, patch);
  // The row was ensured above; `update` returns it. Fall back defensively.
  if (!updated) {
    return getSettings(userId);
  }
  return toPublicSettings(updated);
}
