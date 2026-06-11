/**
 * Base maintenance queue (H5.1) — the single reusable queue definition shared by
 * the API (producer) and the worker (consumer). v1 defines NO business jobs
 * (ADR-007); the only optional job is periodic refresh-token cleanup (H5.2),
 * scheduled by the worker when ENABLE_TOKEN_CLEANUP is set.
 */

import { Queue } from 'bullmq';

import { getRedisConnectionOptions } from './connection';

/** BullMQ queue name (also the Redis key prefix `bull:maintenance:*`). */
export const MAINTENANCE_QUEUE = 'maintenance';

/** Job name: delete expired refresh tokens (H5.2). */
export const JOB_CLEANUP_REFRESH_TOKENS = 'cleanup-refresh-tokens';

let queue: Queue | null = null;

/** Lazily-created singleton Queue handle (producer side). */
export function getMaintenanceQueue(): Queue {
  if (!queue) {
    queue = new Queue(MAINTENANCE_QUEUE, { connection: getRedisConnectionOptions() });
  }
  return queue;
}

/** Close the queue handle (graceful shutdown). */
export async function closeMaintenanceQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
