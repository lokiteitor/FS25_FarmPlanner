/**
 * BullMQ worker entrypoint (H5).
 *
 * Ships the worker container and its lifecycle wiring. v1 has NO business jobs
 * (ADR-007): the worker connects to Redis, registers the maintenance-queue
 * processor and waits. The single optional job — periodic refresh-token cleanup
 * (H5.2) — is only scheduled when ENABLE_TOKEN_CLEANUP is true (default false),
 * so by default the worker idles, exactly as the acceptance criteria require.
 */

import { Worker } from 'bullmq';

import { env } from './config/env';
import { closeDb } from './db/client';
import { getRedisConnectionOptions } from './queues/connection';
import {
  MAINTENANCE_QUEUE,
  JOB_CLEANUP_REFRESH_TOKENS,
  getMaintenanceQueue,
  closeMaintenanceQueue,
} from './queues/maintenance.queue';
import { processMaintenanceJob } from './queues/maintenance.processor';

/** Repeat interval for the optional cleanup job: once per day. */
const CLEANUP_EVERY_MS = 24 * 60 * 60 * 1000;

function log(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[worker] ${message}`);
}

async function main(): Promise<void> {
  const connection = getRedisConnectionOptions();

  const worker = new Worker(MAINTENANCE_QUEUE, processMaintenanceJob, {
    connection,
  });

  worker.on('ready', () => log(`ready — listening on "${MAINTENANCE_QUEUE}"`));
  worker.on('completed', (job, result) =>
    log(`job ${job.name} (${job.id}) completed: ${JSON.stringify(result)}`),
  );
  worker.on('failed', (job, err) =>
    log(`job ${job?.name} (${job?.id}) failed: ${err.message}`),
  );
  worker.on('error', (err) => log(`worker error: ${err.message}`));

  if (env.ENABLE_TOKEN_CLEANUP) {
    // Schedule a repeatable cleanup job (idempotent: fixed jobId/repeat key).
    const queue = getMaintenanceQueue();
    await queue.add(
      JOB_CLEANUP_REFRESH_TOKENS,
      {},
      {
        repeat: { every: CLEANUP_EVERY_MS },
        jobId: JOB_CLEANUP_REFRESH_TOKENS,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
    log('refresh-token cleanup ENABLED (every 24h)');
  } else {
    log('no business jobs in v1 (set ENABLE_TOKEN_CLEANUP=true to enable cleanup)');
  }

  let shuttingDown = false;
  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`received ${signal}, shutting down`);
    try {
      await worker.close();
      await closeMaintenanceQueue();
      await closeDb();
    } catch (err) {
      log(`error during shutdown: ${(err as Error).message}`);
    } finally {
      process.exit(0);
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  log(`fatal: ${(err as Error).message}`);
  process.exit(1);
});
