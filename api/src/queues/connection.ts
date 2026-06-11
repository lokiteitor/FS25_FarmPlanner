/**
 * Shared Redis connection settings for BullMQ (H5.1).
 *
 * We expose connection OPTIONS (not a pre-built ioredis instance) so BullMQ owns
 * the connection lifecycle and so the SAME definition is reused by the API
 * (producer) and the worker (consumer) — ADR-007. Passing an ioredis instance
 * is avoided on purpose: BullMQ bundles its own copy of ioredis, so an instance
 * from the top-level ioredis is a different type and won't type-check.
 *
 * `maxRetriesPerRequest: null` is required by BullMQ's blocking commands.
 */

import type { ConnectionOptions } from 'bullmq';

import { env } from '../config/env';

/** Parse REDIS_URL into BullMQ connection options. */
export function getRedisConnectionOptions(): ConnectionOptions {
  const url = new URL(env.REDIS_URL);
  const options: ConnectionOptions = {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    maxRetriesPerRequest: null,
  };
  if (url.username) {
    options.username = decodeURIComponent(url.username);
  }
  if (url.password) {
    options.password = decodeURIComponent(url.password);
  }
  if (url.pathname.length > 1) {
    options.db = Number(url.pathname.slice(1));
  }
  return options;
}
