// BullMQ worker entrypoint.
//
// v1 ships the worker container and its lifecycle wiring but NO business jobs
// (see ADR-007). The Redis connection, base queue and processor skeleton arrive
// in H5; the only optional job is periodic refresh-token cleanup (H5.2).
// For now this process just stays alive so the container is healthy.

// eslint-disable-next-line no-console
console.log('[worker] started — no business jobs in v1 (BullMQ infra arrives in H5)');

// Keep the event loop alive without doing any work.
const keepAlive = setInterval(() => {
  /* no-op heartbeat */
}, 60_000);

function shutdown(signal: NodeJS.Signals): void {
  // eslint-disable-next-line no-console
  console.log(`[worker] received ${signal}, shutting down`);
  clearInterval(keepAlive);
  process.exit(0);
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
