/**
 * Public surface of the queue infrastructure (H5). Reusable from both the API
 * (producer) and the worker (consumer). v1 ships the wiring with no business
 * jobs (ADR-007).
 */

export { getRedisConnectionOptions } from './connection';
export {
  MAINTENANCE_QUEUE,
  JOB_CLEANUP_REFRESH_TOKENS,
  getMaintenanceQueue,
  closeMaintenanceQueue,
} from './maintenance.queue';
export {
  processMaintenanceJob,
  cleanupExpiredRefreshTokens,
  CLEANUP_GRACE_DAYS,
  type CleanupResult,
} from './maintenance.processor';
