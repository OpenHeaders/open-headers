/**
 * The traffic tap — source registry over the two installers
 * (AGENT_TRAFFIC_PLAN.md §2, §8 S1). One armed source = one retention
 * ring + one reducer + one live subscription; disarming releases the
 * subscription and drops the pair.
 *
 * S2 additions, per PLAN §4:
 *
 *   - **Idle expiry.** An armed source streams (the extension emits
 *     telemetry with no panel open — risk 5), so an arm is never
 *     open-ended: it lapses at `expiresAtMs` unless observe reads keep
 *     it warm. `records()` pushes the expiry forward; `status()` does
 *     not (a polling UI must not keep a source streaming). A sweep
 *     timer disarms lapsed sources so the wire cost actually stops.
 *   - **Reveal escalation.** Unredacted projections are a separate,
 *     deliberate, per-source, time-boxed grant: `escalate(uid, ttl)`
 *     opens a hard-capped window during which reads project raw
 *     values; outside it every read is redacted at the projection
 *     boundary. No wire channel exposes this — the seam exists so a
 *     later operator affordance can surface it without touching the
 *     projection law.
 *
 * S3 adds the body plane (PLAN §3), both halves riding the source
 * connection's `request-body` pull with the `body-attached` answer
 * intercepted before the reducer:
 *
 *   - **Eager failure bodies** — the consumer's `onFailure` seam fires
 *     when a record classifies as a body-bearing HTTP failure; the tap
 *     pulls the final hop's body and the ring retains it capped,
 *     counted against the byte ceiling. Dispatch is deferred a
 *     microtask so a synchronously-delivered answer (the proxy hub)
 *     never re-enters the ring mid-fold.
 *   - **On-demand bodies** (`pullBody`) — best-effort by design: the
 *     engine serves a body only while the tab lives and the entry is
 *     still cached, and only a CDP/proxy-owned partition can serve one
 *     at all, so a pull that answers with silence resolves to an
 *     honest `unavailable` reason after a bounded wait. Success bodies
 *     are never retained.
 *
 * S4 adds the wait plane (`waitForRecord`) over the consumer's
 * admission/refinement seam: a bounded watch that resolves with the
 * first retained projection matching a caller predicate — already-
 * retained matches resolve immediately; otherwise the first admission
 * or refinement that satisfies the predicate settles it. Every outcome
 * (match, timeout, disarm) removes the watch — a lapsed wait never
 * leaks a watcher, and `status()` reports the pending count so an
 * operator can see an agent holding a wait open.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { PROXY_LIFECYCLE_TAB_ID } from '@openheaders/core/proxy';
import type {
  TrafficBodyProjection,
  TrafficRecordProjection,
  TrafficRetentionStats,
  TrafficSourceProjection,
} from '@openheaders/core/traffic';
import type { InspectorHarBody } from '@openheaders/core/types';
import type { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import {
  DEFAULT_TRAFFIC_RETENTION_BOUNDS,
  projectPulledBody,
  type TrafficRetentionBounds,
  TrafficRetentionConsumer,
  TrafficRetentionRing,
} from '@openheaders/oracle/traffic-retention';

import type { LoopbackLifelineDialer } from './loopback-lifeline';
import { connectBrowserTabSource, connectProxySource, type TrafficSourceConnection } from './sources';

const SCOPE = 'TrafficTap';

/** Default arm lifetime; observe reads extend it by the same span. */
export const DEFAULT_TRAFFIC_ARM_TTL_MS = 30 * 60 * 1000;

/** Hard ceiling on one reveal escalation window (PLAN §4: time-boxed). */
export const MAX_TRAFFIC_REVEAL_TTL_MS = 15 * 60 * 1000;

/** Cadence of the lapsed-source sweep. */
const EXPIRY_SWEEP_INTERVAL_MS = 30 * 1000;

/** Bounded wait on one on-demand body pull. The engine answers a pull
 *  it cannot satisfy with silence (never an error frame), so absence of
 *  a `body-attached` inside this window IS the unavailability signal. */
export const TRAFFIC_BODY_PULL_TIMEOUT_MS = 10 * 1000;

export interface TrafficTapDeps {
  readonly dialer: LoopbackLifelineDialer;
  /** The daemon-side proxy-capture hub (`proxyCaptureService.hub`). */
  readonly proxyHub: RequestLifecycleHub;
  /** `proxyCaptureService.serveRequestBody` — the proxy partition's
   *  body plane. Absent ⇒ proxy pulls answer with silence. */
  readonly proxyServeRequestBody?: (requestId: string, hopIndex: number) => void;
}

export interface TrafficArmOptions {
  /** Ring bounds override — e2e drives small bounds through this; the
   *  defaults are the production sizing (PLAN §3). */
  readonly bounds?: Partial<TrafficRetentionBounds>;
  /** Arm lifetime override (e2e drives a tiny one); defaults to
   *  {@link DEFAULT_TRAFFIC_ARM_TTL_MS}. */
  readonly ttlMs?: number;
}

export interface TrafficSourceStatus extends TrafficSourceProjection {
  readonly stats: TrafficRetentionStats;
  /** Live `waitForRecord` watches on this source — an operator-visible
   *  sign an agent is holding a wait open (and the no-leak pin: every
   *  settled wait returns this to its prior count). */
  readonly pendingWaits: number;
}

export interface TrafficRecordsOptions {
  /** Attach retained failure bodies to the projections (PLAN §3
   *  carve-out). Off by default — list reads stay body-free. */
  readonly includeFailureBodies?: boolean;
}

/** Why a body pull answered without a body — honest, never a throw. */
export type TrafficBodyUnavailableReason = 'unknown-request' | 'in-flight' | 'no-response-body' | 'gone';

export type TrafficBodyPullResult =
  | { readonly ok: true; readonly body: TrafficBodyProjection }
  | { readonly ok: false; readonly reason: TrafficBodyUnavailableReason };

/** How a bounded wait settled without a match — a result, never a throw. */
export type TrafficWaitMissReason = 'timeout' | 'source-disarmed';

export type TrafficWaitResult =
  | { readonly ok: true; readonly record: TrafficRecordProjection }
  | { readonly ok: false; readonly reason: TrafficWaitMissReason };

export interface TrafficWaitOptions {
  /** Hard bound on the watch — the caller owns transport-appropriate
   *  clamping; the tap just honors what it is given. */
  readonly timeoutMs: number;
}

export interface TrafficTap {
  /** Arm one browser tab. Idempotent per partition — arming an armed
   *  source returns the existing uid. `null` = the relay refused the
   *  dial (not installed). */
  armBrowserTab(nodeId: string, tabId: number, options?: TrafficArmOptions): string | null;
  /** Arm the proxy capture partition. Idempotent, like the tab arm. */
  armProxy(options?: TrafficArmOptions): string;
  /** Disarm and release the subscription. `false` = unknown uid. */
  disarm(uid: string): boolean;
  /** Every ARMED source with its content-free counters. An unarmed
   *  source is absent — not merely unreadable (PLAN §4). Never extends
   *  an arm: polling a status surface must not keep a source streaming. */
  status(): TrafficSourceStatus[];
  /** One armed source's retained records, as redacted projections
   *  (raw only inside an active reveal window). An observe read keeps
   *  the source warm — the idle expiry moves forward. */
  records(uid: string, options?: TrafficRecordsOptions): TrafficRecordProjection[] | null;
  /** One retained record (failure body attached when present), or
   *  `null` for an unknown uid OR an unknown requestId — the caller
   *  distinguishes via {@link status}. An observe read; extends the arm. */
  getRecord(uid: string, requestId: string): TrafficRecordProjection | null;
  /**
   * Pull one exchange's response body on demand (PLAN §3): a retained
   * failure body answers immediately; otherwise the final hop's body is
   * pulled over the source connection, capped and redacted at the
   * boundary, and NOT retained. `null` = unknown uid. An observe read;
   * extends the arm.
   */
  pullBody(uid: string, requestId: string): Promise<TrafficBodyPullResult | null>;
  /**
   * Block until a retained projection matches `match` (S4). An already-
   * retained match resolves immediately (FIFO-oldest first); otherwise
   * the watch settles on the first admission/refinement that satisfies
   * the predicate, on the bounded timeout, or on disarm — and is
   * removed on EVERY outcome (no leaked watch). The predicate sees
   * redacted projections only. `null` = unknown uid. An observe read;
   * extends the arm.
   */
  waitForRecord(
    uid: string,
    match: (record: TrafficRecordProjection) => boolean,
    options: TrafficWaitOptions,
  ): Promise<TrafficWaitResult | null>;
  /** Open a time-boxed reveal window on one armed source — the ONLY
   *  path to unredacted projections. Capped at
   *  {@link MAX_TRAFFIC_REVEAL_TTL_MS}; `false` = unknown uid. */
  escalate(uid: string, ttlMs: number): boolean;
  /** Disarm everything. Idempotent. */
  dispose(): void;
}

interface ArmedSource {
  readonly projection: Omit<TrafficSourceProjection, 'state' | 'expiresAtMs'>;
  readonly consumer: TrafficRetentionConsumer;
  readonly ring: TrafficRetentionRing;
  readonly ttlMs: number;
  /** The partition's tab id — the ring key half every record carries. */
  readonly partitionTabId: number;
  /** On-demand pull waiters, keyed `requestId:hopIndex`. */
  readonly bodyWaiters: Map<string, Array<(body: InspectorHarBody) => void>>;
  /** Live `waitForRecord` watches (S4) — settled and removed on match,
   *  timeout, and disarm alike. */
  readonly recordWaiters: Set<RecordWaiter>;
  connection: TrafficSourceConnection | null;
  state: TrafficSourceProjection['state'];
  expiresAtMs: number;
  /** Active reveal window's end, or null while redaction holds. */
  revealUntilMs: number | null;
}

function resolveBounds(options?: TrafficArmOptions): TrafficRetentionBounds {
  return {
    maxRecords: options?.bounds?.maxRecords ?? DEFAULT_TRAFFIC_RETENTION_BOUNDS.maxRecords,
    maxBytes: options?.bounds?.maxBytes ?? DEFAULT_TRAFFIC_RETENTION_BOUNDS.maxBytes,
  };
}

function resolveTtl(options?: TrafficArmOptions): number {
  const ttl = options?.ttlMs;
  return typeof ttl === 'number' && Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_TRAFFIC_ARM_TTL_MS;
}

function bodyWaiterKey(requestId: string, hopIndex: number): string {
  return `${requestId}:${hopIndex}`;
}

interface RecordWaiter {
  readonly match: (record: TrafficRecordProjection) => boolean;
  readonly settle: (result: TrafficWaitResult) => void;
}

export function createTrafficTap(deps: TrafficTapDeps): TrafficTap {
  const sources = new Map<string, ArmedSource>();

  function disarm(uid: string): boolean {
    const source = sources.get(uid);
    if (source === undefined) return false;
    source.connection?.close();
    source.bodyWaiters.clear();
    // Settle live waits before dropping the source — a disarm (or lapse)
    // mid-wait answers honestly instead of leaving a promise pending.
    const waiters = [...source.recordWaiters];
    source.recordWaiters.clear();
    for (const waiter of waiters) waiter.settle({ ok: false, reason: 'source-disarmed' });
    sources.delete(uid);
    logger.info(SCOPE, `disarmed ${uid}`);
    return true;
  }

  /** The consumer's admission/refinement seam → predicate evaluation.
   *  Projected ONCE per event, and only while a watch is pending. */
  function notifyRecord(uid: string, tabId: number, requestId: string): void {
    const source = sources.get(uid);
    if (source === undefined || source.recordWaiters.size === 0) return;
    const record = source.ring.projectOne(tabId, requestId);
    if (record === null) return;
    let matched = false;
    for (const waiter of [...source.recordWaiters]) {
      if (!waiter.match(record)) continue;
      source.recordWaiters.delete(waiter);
      matched = true;
      waiter.settle({ ok: true, record });
    }
    // A settled wait is a completed observe read — it keeps the arm warm
    // like every other record-bearing read.
    if (matched) touchForRead(source);
  }

  function sweepExpired(): void {
    const now = Date.now();
    for (const [uid, source] of sources) {
      if (source.expiresAtMs <= now) {
        logger.info(SCOPE, `arm expired for ${uid}`);
        disarm(uid);
      }
    }
  }

  // The sweep stops the wire/battery cost of a forgotten arm even when
  // nothing ever reads again; unref'd so the tap never holds the
  // process open.
  const sweepTimer = setInterval(sweepExpired, EXPIRY_SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();

  /** One `body-attached` answer: settle on-demand waiters, then offer
   *  the body to the ring's failure carve-out (admission is gated by
   *  the consumer's request stamp — an unrequested body is dropped). */
  function handleBodyAttached(uid: string, requestId: string, hopIndex: number, body: InspectorHarBody): void {
    const source = sources.get(uid);
    if (source === undefined) return;
    const key = bodyWaiterKey(requestId, hopIndex);
    const waiters = source.bodyWaiters.get(key);
    if (waiters !== undefined) {
      source.bodyWaiters.delete(key);
      for (const resolve of waiters) resolve(body);
    }
    source.ring.attachFailureBody(source.partitionTabId, requestId, body);
  }

  /** The consumer's eager-failure seam → one deferred pull. Deferred a
   *  microtask: the seam fires inside a ring fold, and the proxy path
   *  answers synchronously — dispatching later keeps the ring
   *  non-reentrant AND lets an arm-time replay classify before the
   *  connection handle is assigned. */
  function pullFailureBody(uid: string, requestId: string, hopIndex: number): void {
    queueMicrotask(() => {
      sources.get(uid)?.connection?.requestBody(requestId, hopIndex);
    });
  }

  function armBrowserTab(nodeId: string, tabId: number, options?: TrafficArmOptions): string | null {
    const uid = `browser-tab:${nodeId}:${tabId}`;
    if (sources.has(uid)) return uid;
    const ring = new TrafficRetentionRing(resolveBounds(options));
    const ttlMs = resolveTtl(options);
    const now = Date.now();
    const source: ArmedSource = {
      projection: {
        uid,
        kind: 'browser-tab',
        label: `tab ${tabId} @ ${nodeId}`,
        nodeId,
        tabId,
        armedAtMs: now,
      },
      ring,
      consumer: new TrafficRetentionConsumer({
        ring,
        initialProvenance: 'heuristic',
        onWatchRefused: () => {
          const live = sources.get(uid);
          if (live !== undefined) live.state = 'refused';
        },
        onFailure: (_tabId, requestId, finalHopIndex) => pullFailureBody(uid, requestId, finalHopIndex),
        onRecord: (recordTabId, requestId) => notifyRecord(uid, recordTabId, requestId),
      }),
      ttlMs,
      partitionTabId: tabId,
      bodyWaiters: new Map(),
      recordWaiters: new Set(),
      connection: null,
      state: 'streaming',
      expiresAtMs: now + ttlMs,
      revealUntilMs: null,
    };
    const connection = connectBrowserTabSource({
      dialer: deps.dialer,
      nodeId,
      tabId,
      consumer: source.consumer,
      onBodyAttached: (requestId, hopIndex, body) => handleBodyAttached(uid, requestId, hopIndex, body),
    });
    if (connection === null) {
      logger.warn(SCOPE, `arm refused for ${uid} — no acceptor claimed the qualified lifeline`);
      return null;
    }
    source.connection = connection;
    sources.set(uid, source);
    logger.info(SCOPE, `armed ${uid}`);
    return uid;
  }

  function armProxy(options?: TrafficArmOptions): string {
    const uid = 'proxy';
    if (sources.has(uid)) return uid;
    const ring = new TrafficRetentionRing(resolveBounds(options));
    const consumer = new TrafficRetentionConsumer({
      ring,
      initialProvenance: 'proxy',
      onFailure: (_tabId, requestId, finalHopIndex) => pullFailureBody(uid, requestId, finalHopIndex),
      onRecord: (recordTabId, requestId) => notifyRecord(uid, recordTabId, requestId),
    });
    const ttlMs = resolveTtl(options);
    const now = Date.now();
    const source: ArmedSource = {
      projection: { uid, kind: 'proxy', label: 'Proxy capture', armedAtMs: now },
      ring,
      consumer,
      ttlMs,
      partitionTabId: PROXY_LIFECYCLE_TAB_ID,
      bodyWaiters: new Map(),
      recordWaiters: new Set(),
      connection: null,
      state: 'streaming',
      expiresAtMs: now + ttlMs,
      revealUntilMs: null,
    };
    sources.set(uid, source);
    source.connection = connectProxySource({
      hub: deps.proxyHub,
      consumer,
      onBodyAttached: (requestId, hopIndex, body) => handleBodyAttached(uid, requestId, hopIndex, body),
      ...(deps.proxyServeRequestBody !== undefined ? { serveBody: deps.proxyServeRequestBody } : {}),
    });
    logger.info(SCOPE, `armed ${uid}`);
    return uid;
  }

  /** Observe-read bookkeeping shared by every record-bearing read. */
  function touchForRead(source: ArmedSource): { revealSecrets: boolean } | undefined {
    const now = Date.now();
    source.expiresAtMs = now + source.ttlMs;
    const reveal = source.revealUntilMs !== null && source.revealUntilMs > now;
    return reveal ? { revealSecrets: true } : undefined;
  }

  return {
    armBrowserTab,
    armProxy,
    disarm,
    escalate(uid, ttlMs) {
      const source = sources.get(uid);
      if (source === undefined || !Number.isFinite(ttlMs) || ttlMs <= 0) return false;
      source.revealUntilMs = Date.now() + Math.min(ttlMs, MAX_TRAFFIC_REVEAL_TTL_MS);
      logger.info(SCOPE, `reveal escalation opened for ${uid}`);
      return true;
    },
    status() {
      sweepExpired();
      const out: TrafficSourceStatus[] = [];
      for (const source of sources.values()) {
        out.push({
          ...source.projection,
          expiresAtMs: source.expiresAtMs,
          state: source.state,
          stats: source.consumer.stats(),
          pendingWaits: source.recordWaiters.size,
        });
      }
      return out;
    },
    records(uid, options) {
      sweepExpired();
      const source = sources.get(uid);
      if (source === undefined) return null;
      const reveal = touchForRead(source);
      return source.ring.snapshot({
        ...(reveal ?? {}),
        ...(options?.includeFailureBodies === true ? { includeFailureBody: true } : {}),
      });
    },
    getRecord(uid, requestId) {
      sweepExpired();
      const source = sources.get(uid);
      if (source === undefined) return null;
      const reveal = touchForRead(source);
      return source.ring.projectOne(source.partitionTabId, requestId, {
        ...(reveal ?? {}),
        includeFailureBody: true,
      });
    },
    async pullBody(uid, requestId) {
      sweepExpired();
      const source = sources.get(uid);
      if (source === undefined) return null;
      const reveal = touchForRead(source);
      const record = source.ring.projectOne(source.partitionTabId, requestId, {
        ...(reveal ?? {}),
        includeFailureBody: true,
      });
      if (record === null) return { ok: false, reason: 'unknown-request' };
      if (record.failureBody !== undefined) return { ok: true, body: record.failureBody };
      if (record.phase === 'pending' || record.phase === 'headers-received') {
        return { ok: false, reason: 'in-flight' };
      }
      if (record.phase === 'failed') return { ok: false, reason: 'no-response-body' };
      const connection = source.connection;
      if (connection === null) return { ok: false, reason: 'gone' };
      const key = bodyWaiterKey(requestId, record.redirectHopCount);
      const answer = await new Promise<InspectorHarBody | null>((resolve) => {
        const waiters = source.bodyWaiters.get(key) ?? [];
        waiters.push(resolve);
        source.bodyWaiters.set(key, waiters);
        connection.requestBody(requestId, record.redirectHopCount);
        setTimeout(() => {
          const pending = source.bodyWaiters.get(key);
          if (pending !== undefined) {
            const remaining = pending.filter((w) => w !== resolve);
            if (remaining.length === 0) source.bodyWaiters.delete(key);
            else source.bodyWaiters.set(key, remaining);
          }
          resolve(null);
        }, TRAFFIC_BODY_PULL_TIMEOUT_MS).unref?.();
      });
      if (answer === null) return { ok: false, reason: 'gone' };
      return { ok: true, body: projectPulledBody(answer, reveal) };
    },
    async waitForRecord(uid, match, options) {
      sweepExpired();
      const source = sources.get(uid);
      if (source === undefined) return null;
      touchForRead(source);
      // Already-retained match: resolve immediately, FIFO-oldest first —
      // registering a waiter and then scanning would answer the same
      // record one event later than necessary; scanning first with no
      // await in between leaves no gap an admission could fall through.
      for (const record of source.ring.snapshot()) {
        if (match(record)) return { ok: true, record };
      }
      return new Promise<TrafficWaitResult>((resolve) => {
        const waiter: RecordWaiter = {
          match,
          settle(result) {
            clearTimeout(timer);
            resolve(result);
          },
        };
        const timer = setTimeout(() => {
          source.recordWaiters.delete(waiter);
          resolve({ ok: false, reason: 'timeout' });
        }, options.timeoutMs);
        timer.unref?.();
        source.recordWaiters.add(waiter);
      });
    },
    dispose() {
      clearInterval(sweepTimer);
      for (const uid of [...sources.keys()]) disarm(uid);
    },
  };
}
