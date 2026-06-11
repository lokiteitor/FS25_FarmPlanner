import { eq } from 'drizzle-orm';
import { db, type DbExecutor } from '../db/client';
import { farms, gameVersions } from '../db/schema';

/**
 * Data access for the `farms` table.
 *
 * Only the registration helper (`createDefault`) and the active-game-version
 * lookup live here for now; the full farm CRUD arrives in H4. Both accept an
 * optional executor (`tx`, defaulting to `db`) so the default farm can be
 * created inside the register transaction.
 */

export type FarmRow = typeof farms.$inferSelect;

export interface CreateDefaultFarmInput {
  userId: string;
  gameVersionId: string;
  /** Defaults to "Mi partida" (docs/base-de-datos.md §1 business rules). */
  name?: string;
}

/** Default name for the farm created automatically at registration. */
export const DEFAULT_FARM_NAME = 'Mi partida';

/**
 * Create the default farm that every new account gets at registration.
 *
 * difficulty 'normal', default_yield_bonus (column default 0.4250) and
 * sell_price_type 'baseline' are taken from the table defaults
 * (docs/base-de-datos.md §9); we don't pass them so a future change to the
 * column defaults stays in one place. Returns the created row.
 */
export async function createDefault(
  input: CreateDefaultFarmInput,
  tx: DbExecutor = db,
): Promise<FarmRow> {
  const [row] = await tx
    .insert(farms)
    .values({
      userId: input.userId,
      gameVersionId: input.gameVersionId,
      name: input.name ?? DEFAULT_FARM_NAME,
      difficulty: 'normal',
      sellPriceType: 'baseline',
    })
    .returning();
  return row;
}

/**
 * Return the id of the single active game version (game_versions.is_active),
 * used as the default version for new farms and catalog reads.
 *
 * Throws a clear error if none is active — that means the catalog was never
 * seeded, which is an operational misconfiguration rather than a user error.
 */
export async function getActiveGameVersionId(
  tx: DbExecutor = db,
): Promise<string> {
  const rows = await tx
    .select({ id: gameVersions.id })
    .from(gameVersions)
    .where(eq(gameVersions.isActive, true))
    .limit(1);

  const active = rows[0];
  if (!active) {
    throw new Error(
      'No active game version found (game_versions.is_active). Seed the catalog before registering farms.',
    );
  }
  return active.id;
}
