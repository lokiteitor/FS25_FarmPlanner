// entities/farm/model/types — domain shapes for a saved game ("partida") and
// the user-settings row that pins the active farm. Mirrors the `Farm` /
// `FarmCreate` / `FarmUpdate` / `UserSettings` / `UserSettingsUpdate` schemas in
// docs/openapi.yaml.
//
// `Difficulty` and `SellPriceType` are shared catalog/domain primitives; we
// re-use entities/catalog's public API (cross-slice via its index.ts, FSD-OK)
// instead of re-declaring them so the engine, catalog and farm agree on one type.

import type { Difficulty, SellPriceType } from '~/entities/catalog'

export type { Difficulty, SellPriceType }

/**
 * A saved game / "partida". Mirrors the `Farm` schema (Timestamps + body).
 * `fieldCount` / `stableCount` are server-computed counters returned by the
 * list/detail endpoints (optional: not part of `required`).
 */
export interface Farm {
  id: string
  userId: string
  gameVersionId: string
  name: string
  mapName: string | null
  difficulty: Difficulty
  /** Farm-wide default yield bonus applied to fields/animals without an override. */
  defaultYieldBonus: number
  sellPriceType: SellPriceType
  notes: string | null
  fieldCount?: number
  stableCount?: number
  createdAt?: string
  updatedAt?: string
}

/** Body for `POST /farms` (FarmCreate). Only `name` is required. */
export interface FarmCreate {
  name: string
  /** Defaults to the active game version on the backend when omitted. */
  gameVersionId?: string
  mapName?: string
  difficulty?: Difficulty
  defaultYieldBonus?: number
  sellPriceType?: SellPriceType
  notes?: string
}

/**
 * Body for `PATCH /farms/:id` (FarmUpdate). All fields optional. Changing
 * `gameVersionId` triggers a server-side crop re-map by slug; dropped crops are
 * reported in `meta.warnings` (surfaced via {@link FarmUpdateResult}).
 */
export interface FarmUpdate {
  name?: string
  gameVersionId?: string
  mapName?: string | null
  difficulty?: Difficulty
  defaultYieldBonus?: number
  sellPriceType?: SellPriceType
  notes?: string | null
}

/** Result of a farm update: the farm plus any non-fatal warnings from `meta`. */
export interface FarmUpdateResult {
  farm: Farm
  /** e.g. crop slugs dropped when the game version changed. */
  warnings: string[]
}

/** UI theme preference (UserSettings.theme enum). */
export type UserTheme = 'system' | 'dark' | 'light'

/** The user's UI settings row, including the active farm pin (UserSettings). */
export interface UserSettings {
  userId: string
  locale: string
  theme: UserTheme
  /** The farm the UI is currently working on; `null` until one is chosen. */
  activeFarmId: string | null
  preferences?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

/** Body for `PATCH /me/settings` (UserSettingsUpdate). All fields optional. */
export interface UserSettingsUpdate {
  locale?: string
  theme?: UserTheme
  activeFarmId?: string | null
  preferences?: Record<string, unknown>
}
