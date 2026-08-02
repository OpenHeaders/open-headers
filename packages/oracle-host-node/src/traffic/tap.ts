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
 *     opens a hard-capped window during which `records()` projects
 *     raw values; outside it every read is redacted at the projection
 *     boundary. No wire channel exposes this in S2 — the seam exists
 *     so the S3+ operator affordance can surface it without touching
 *     the projection law.
 *
 * The `observe` tier and the MCP tools arrive S3 on top of this seam;
 * the stats surface stays content-free by construction (counters,
 * never records).
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import type {
  TrafficRecordProjection,
  TrafficRetentionStats,
  TrafficSourceProjection,
} from '@openheaders/core/traffic';
import type { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import {
  DEFAULT_TRAFFIC_RETENTION_BOUNDS,
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

export interface TrafficTapDeps {
  readonly dialer: LoopbackLifelineDialer;
  /** The daemon-side proxy-capture hub (`proxyCaptureService.hub`). */
  readonly proxyHub: RequestLifecycleHub;
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
  records(uid: string): TrafficRecordProjection[] | null;
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

export function createTrafficTap(deps: TrafficTapDeps): TrafficTap {
  const sources = new Map<string, ArmedSource>();

  function disarm(uid: string): boolean {
    const source = sources.get(uid);
    if (source === undefined) return false;
    source.connection?.close();
    sources.delete(uid);
    logger.info(SCOPE, `disarmed ${uid}`);
    return true;
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
      }),
      ttlMs,
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
    const consumer = new TrafficRetentionConsumer({ ring, initialProvenance: 'proxy' });
    const ttlMs = resolveTtl(options);
    const now = Date.now();
    const source: ArmedSource = {
      projection: { uid, kind: 'proxy', label: 'Proxy capture', armedAtMs: now },
      ring,
      consumer,
      ttlMs,
      connection: connectProxySource({ hub: deps.proxyHub, consumer }),
      state: 'streaming',
      expiresAtMs: now + ttlMs,
      revealUntilMs: null,
    };
    sources.set(uid, source);
    logger.info(SCOPE, `armed ${uid}`);
    return uid;
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
        });
      }
      return out;
    },
    records(uid) {
      sweepExpired();
      const source = sources.get(uid);
      if (source === undefined) return null;
      const now = Date.now();
      source.expiresAtMs = now + source.ttlMs;
      const reveal = source.revealUntilMs !== null && source.revealUntilMs > now;
      return source.ring.snapshot(reveal ? { revealSecrets: true } : undefined);
    },
    dispose() {
      clearInterval(sweepTimer);
      for (const uid of [...sources.keys()]) disarm(uid);
    },
  };
}
