/**
 * Processor for the maintenance queue (H5.1/H5.2).
 *
 * The only implemented job is `cleanup-refresh-tokens`, which deletes refresh
 * tokens that expired more than a grace period ago (docs/base-de-datos.md
 * "Retención / Limpieza"). Kept tiny and pure so it is trivially testable
 * without BullMQ/Redis.
 */

import type { Job } from 'bullmq';

import * as refreshTokensRepo from '../repositories/refreshTokens.repository';
import { JOB_CLEANUP_REFRESH_TOKENS } from './maintenance.queue';

/** Grace period: only delete tokens expired for at least this many days. */
export const CLEANUP_GRACE_DAYS = 7;

export interface CleanupResult {
  deleted: number;
}

/** Run the refresh-token cleanup; returns how many rows were deleted. */
export async function cleanupExpiredRefreshTokens(): Promise<CleanupResult> {
  const deleted = await refreshTokensRepo.deleteExpired(CLEANUP_GRACE_DAYS);
  return { deleted };
}

/** BullMQ processor entrypoint: dispatch by job name. */
export async function processMaintenanceJob(job: Job): Promise<unknown> {
  switch (job.name) {
    case JOB_CLEANUP_REFRESH_TOKENS:
      return cleanupExpiredRefreshTokens();
    default:
      throw new Error(`[worker] unknown maintenance job: ${job.name}`);
  }
}
