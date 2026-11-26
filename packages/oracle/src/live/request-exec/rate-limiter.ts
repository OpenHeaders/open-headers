/**
 * Per-host token bucket shared across every refresh-subsystem fetch.
 *
 * Why: ARCHITECTURE §20's "rules engine — live traffic modification
 * with auto-refresh" + the Live Variables plan §C both call out "token
 * bucket keyed by URL origin across ALL step fetches" so 20 workflows
 * against the same upstream serialize instead of racing to 429-land.
 * OAuth's token endpoint and Live Workflow chain steps both live on
 * this primitive — two consumers today, a third (DNR rule-refresh)
 * when its pipeline lands.
 *
 * Design:
 *   - Keyed by `URL.origin` so `https://api.example.com/a` and
 *     `https://api.example.com/b` share a bucket, but different ports /
 *     schemes get their own. Matches how most rate-limiting reverse
 *     proxies work.
 *   - Two invariants per origin:
 *       (1) at most `maxConcurrent` in-flight requests (default 1),
 *       (2) at most `maxPerMinute` request STARTS in any 60-second
 *           sliding window (default 5).
 *   - Waiters are FIFO-queued. A request that would violate either
 *     invariant blocks on a promise; the current holder resolves it
 *     after completion (or slot-free time) passes.
 *   - Opaque URL strings (`data:` / invalid / relative) bypass the
 *     limiter — they don't hit a network origin, so the bucket doesn't
 *     apply. The limiter's contract is "network-bound fetches only";
 *     fallthrough keeps callers simple.
 *   - A caller may be told when its call waits for a slot and when it
 *     starts, and may ask for a start the minute window passes over —
 *     a poll's re-send, paced by the poll's own wait. One in flight per
 *     origin holds for every call.
 *
 * The module exposes a single process-level singleton so both OAuth
 * and Live see the same bucket for `accounts.google.com` (OAuth refresh
 * and a Live-Workflow step fetch both pay the same budget). Tests use
 * `__resetRateLimiterForTests` + `__configureRateLimiterForTests` for
 * deterministic setup.
 */

import { logger } from '@openheaders/core/utils';

// ── Tunables ───────────────────────────────────────────────────────

export interface RateLimiterConfig {
  /** Max concurrent in-flight requests per origin. */
  maxConcurrent: number;
  /** Max request STARTS per minute per origin (sliding 60-second window). */
  maxPerMinute: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxConcurrent: 1,
  maxPerMinute: 5,
};

// ── Internal state ─────────────────────────────────────────────────

interface HostBucket {
  inFlight: number;
  /** Absolute-ms timestamps of request STARTS in the trailing minute. */
  recentStartsMs: number[];
  /** FIFO waiter queue — `resolve()` is called when a slot opens. */
  waiters: Array<{ counted: boolean; resolve: () => void }>;
}

export interface RateLimitedCall {
  /** A start the minute window neither counts nor holds. */
  uncounted?: boolean;
  /** The call waits for a slot. */
  onHeld?: () => void;
  /** The call starts now — at once for a URL the limiter does not gate. */
  onLeave?: () => void;
}

let config: RateLimiterConfig = { ...DEFAULT_CONFIG };
const buckets: Map<string, HostBucket> = new Map();

function bucketFor(origin: string): HostBucket {
  let bucket = buckets.get(origin);
  if (!bucket) {
    bucket = { inFlight: 0, recentStartsMs: [], waiters: [] };
    buckets.set(origin, bucket);
  }
  return bucket;
}

function pruneOldStarts(bucket: HostBucket, nowMs: number): void {
  const cutoff = nowMs - 60_000;
  while (bucket.recentStartsMs.length > 0 && bucket.recentStartsMs[0] < cutoff) {
    bucket.recentStartsMs.shift();
  }
}

function canStart(bucket: HostBucket, nowMs: number, counted: boolean): boolean {
  pruneOldStarts(bucket, nowMs);
  if (bucket.inFlight >= config.maxConcurrent) return false;
  if (counted && bucket.recentStartsMs.length >= config.maxPerMinute) return false;
  return true;
}

function start(bucket: HostBucket, counted: boolean): void {
  bucket.inFlight += 1;
  if (counted) bucket.recentStartsMs.push(Date.now());
}

function nextAvailableMs(bucket: HostBucket): number {
  // Concurrency is released by `release()` (no time-based prediction
  // possible). Minute-window availability is the oldest start + 60s.
  if (bucket.recentStartsMs.length < config.maxPerMinute) return Date.now();
  return bucket.recentStartsMs[0] + 60_000;
}

function releaseSlot(origin: string): void {
  const bucket = buckets.get(origin);
  if (!bucket) return;
  bucket.inFlight = Math.max(0, bucket.inFlight - 1);
  drainWaiters(origin);
}

function drainWaiters(origin: string): void {
  const bucket = buckets.get(origin);
  if (!bucket) return;
  const now = Date.now();
  // In order, passing over a waiter only the minute window holds: one
  // the window does not count may start behind it.
  let index = 0;
  while (index < bucket.waiters.length && bucket.inFlight < config.maxConcurrent) {
    const waiter = bucket.waiters[index];
    if (!canStart(bucket, now, waiter.counted)) {
      index += 1;
      continue;
    }
    bucket.waiters.splice(index, 1);
    start(bucket, waiter.counted);
    waiter.resolve();
  }
  // If there are still waiters but the minute-window is blocking, arm a
  // setTimeout to re-drain when the oldest start ages out. We skip this
  // when concurrency alone is the blocker — `releaseSlot` drains on
  // completion instead.
  if (bucket.waiters.length > 0 && bucket.inFlight < config.maxConcurrent) {
    const wakeMs = Math.max(50, nextAvailableMs(bucket) - Date.now());
    setTimeout(() => drainWaiters(origin), wakeMs);
  }
}

// ── Public API ─────────────────────────────────────────────────────

function safeOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Acquire a slot for a fetch against `url`, run `fn`, release on
 * completion. Callers always call through this wrapper — bare `fetch`
 * in the refresh path bypasses the bucket and undermines the contract.
 *
 * Non-network URLs (bad scheme, malformed) fall through to `fn()`
 * without limiting. Exceptions thrown from `fn` still release the slot.
 */
export async function withRefreshRateLimit<T>(
  url: string,
  fn: () => Promise<T>,
  call: RateLimitedCall = {},
): Promise<T> {
  const origin = safeOrigin(url);
  if (!origin) {
    call.onLeave?.();
    return fn();
  }
  await acquire(origin, call);
  try {
    call.onLeave?.();
    return await fn();
  } finally {
    releaseSlot(origin);
  }
}

function acquire(origin: string, call: RateLimitedCall): Promise<void> {
  const bucket = bucketFor(origin);
  const counted = call.uncounted !== true;
  if (canStart(bucket, Date.now(), counted)) {
    start(bucket, counted);
    return Promise.resolve();
  }
  logger.debug('RefreshRateLimit', `Queued request for ${origin} (inFlight=${bucket.inFlight})`);
  call.onHeld?.();
  return new Promise<void>((resolve) => {
    bucket.waiters.push({ counted, resolve });
    // Arm a drain for the minute-window case — concurrency releases
    // trigger `drainWaiters` via `releaseSlot`, but a purely rate-limit
    // wait only drains when the oldest start ages out.
    if (bucket.inFlight < config.maxConcurrent && bucket.recentStartsMs.length >= config.maxPerMinute) {
      const wakeMs = Math.max(50, nextAvailableMs(bucket) - Date.now());
      setTimeout(() => drainWaiters(origin), wakeMs);
    }
  });
}

/**
 * Snapshot a bucket's state for telemetry / tests. Returns null for an
 * unknown origin (no bucket allocated yet — effectively empty).
 */
export function inspectRateLimiter(origin: string): {
  inFlight: number;
  recentStartsInMinute: number;
  queued: number;
} | null {
  const bucket = buckets.get(origin);
  if (!bucket) return null;
  pruneOldStarts(bucket, Date.now());
  return {
    inFlight: bucket.inFlight,
    recentStartsInMinute: bucket.recentStartsMs.length,
    queued: bucket.waiters.length,
  };
}

// ── Test helpers ───────────────────────────────────────────────────

/** Reset state across tests so buckets / waiters don't bleed. */
export function __resetRateLimiterForTests(): void {
  buckets.clear();
  config = { ...DEFAULT_CONFIG };
}

/** Override tunables for deterministic unit tests. */
export function __configureRateLimiterForTests(next: Partial<RateLimiterConfig>): void {
  config = { ...config, ...next };
}
