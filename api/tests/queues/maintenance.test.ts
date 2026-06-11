import { randomUUID } from 'node:crypto';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';

import { refreshTokens } from '../../src/db/schema';
import * as refreshTokensRepo from '../../src/repositories/refreshTokens.repository';
import {
  processMaintenanceJob,
  CLEANUP_GRACE_DAYS,
} from '../../src/queues/maintenance.processor';
import { startHarness, stopHarness, createUser, type DbHarness } from '../db/helpers';

/**
 * H5.2 — periodic refresh-token cleanup. We exercise the real DELETE SQL against
 * a container DB by passing the container-scoped drizzle client as the tx
 * (deleteExpired(days, tx)); the BullMQ worker boot is verified separately.
 */
describe('Maintenance: refresh-token cleanup (H5.2)', () => {
  let harness: DbHarness;
  let userId: string;

  beforeAll(async () => {
    harness = await startHarness();
    userId = await createUser(harness);
  }, 120_000);

  afterAll(async () => {
    await stopHarness(harness);
  });

  function daysFromNow(days: number): Date {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  async function insertToken(expiresAt: Date): Promise<void> {
    await harness.db.insert(refreshTokens).values({
      userId,
      tokenHash: randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, ''),
      expiresAt,
    });
  }

  it('deletes only tokens expired beyond the grace period', async () => {
    await harness.db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

    await insertToken(daysFromNow(-(CLEANUP_GRACE_DAYS + 3))); // long expired -> delete
    await insertToken(daysFromNow(-(CLEANUP_GRACE_DAYS - 2))); // recently expired -> keep (grace)
    await insertToken(daysFromNow(30)); // active -> keep

    const deleted = await refreshTokensRepo.deleteExpired(CLEANUP_GRACE_DAYS, harness.db);
    expect(deleted).toBe(1);

    const remaining = await harness.db
      .select({ id: refreshTokens.id })
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, userId));
    expect(remaining).toHaveLength(2);
  });

  it('is a no-op when nothing is past the grace period', async () => {
    await harness.db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    await insertToken(daysFromNow(-(CLEANUP_GRACE_DAYS - 1)));
    await insertToken(daysFromNow(10));

    const deleted = await refreshTokensRepo.deleteExpired(CLEANUP_GRACE_DAYS, harness.db);
    expect(deleted).toBe(0);
  });

  it('processMaintenanceJob rejects unknown job names', async () => {
    await expect(
      processMaintenanceJob({ name: 'does-not-exist' } as never),
    ).rejects.toThrow(/unknown maintenance job/);
  });
});
