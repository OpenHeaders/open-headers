/**
 * The traffic tap — source registry over the two installers
 * (AGENT_TRAFFIC_PLAN.md §2, §8 S1). One armed source = one retention
 * ring + one reducer + one live subscription; disarming releases the
 * subscription and drops the pair.
 *
 * S1 scope: the registry and its operator-plane controls only. The
 * `observe` tier, the arming UI and every MCP tool arrive in S2/S3 on
 * top of this seam — nothing here is reachable by an agent token, and
 * the stats surface is content-free by construction (counters, never
 * records). In-process consumers (the S3 tools) will read
 * `records(uid)`, which already crosses the store boundary as redacted
 * projections only.
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

export interface TrafficTapDeps {
  readonly dialer: LoopbackLifelineDialer;
  /** The daemon-side proxy-capture hub (`proxyCaptureService.hub`). */
  readonly proxyHub: RequestLifecycleHub;
}

export interface TrafficArmOptions {
  /** Ring bounds override — e2e drives small bounds through this; the
   *  defaults are the production sizing (PLAN §3). */
  readonly bounds?: Partial<TrafficRetentionBounds>;
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
   *  source is absent — not merely unreadable (PLAN §4). */
  status(): TrafficSourceStatus[];
  /** One armed source's retained records, as redacted projections. The
   *  S3 tool layer reads this; nothing exposes it over a wire in S1. */
  records(uid: string): TrafficRecordProjection[] | null;
  /** Disarm everything. Idempotent. */
  dispose(): void;
}

interface ArmedSource {
  readonly projection: Omit<TrafficSourceProjection, 'state'>;
  readonly consumer: TrafficRetentionConsumer;
  readonly ring: TrafficRetentionRing;
  connection: TrafficSourceConnection | null;
  state: TrafficSourceProjection['state'];
}

function resolveBounds(options?: TrafficArmOptions): TrafficRetentionBounds {
  return {
    maxRecords: options?.bounds?.maxRecords ?? DEFAULT_TRAFFIC_RETENTION_BOUNDS.maxRecords,
    maxBytes: options?.bounds?.maxBytes ?? DEFAULT_TRAFFIC_RETENTION_BOUNDS.maxBytes,
  };
}

export function createTrafficTap(deps: TrafficTapDeps): TrafficTap {
  const sources = new Map<string, ArmedSource>();

  function armBrowserTab(nodeId: string, tabId: number, options?: TrafficArmOptions): string | null {
    const uid = `browser-tab:${nodeId}:${tabId}`;
    if (sources.has(uid)) return uid;
    const ring = new TrafficRetentionRing(resolveBounds(options));
    const source: ArmedSource = {
      projection: {
        uid,
        kind: 'browser-tab',
        label: `tab ${tabId} @ ${nodeId}`,
        armedAtMs: Date.now(),
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
      connection: null,
      state: 'streaming',
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
    const source: ArmedSource = {
      projection: { uid, kind: 'proxy', label: 'Proxy capture', armedAtMs: Date.now() },
      ring,
      consumer,
      connection: connectProxySource({ hub: deps.proxyHub, consumer }),
      state: 'streaming',
    };
    sources.set(uid, source);
    logger.info(SCOPE, `armed ${uid}`);
    return uid;
  }

  function disarm(uid: string): boolean {
    const source = sources.get(uid);
    if (source === undefined) return false;
    source.connection?.close();
    sources.delete(uid);
    logger.info(SCOPE, `disarmed ${uid}`);
    return true;
  }

  return {
    armBrowserTab,
    armProxy,
    disarm,
    status() {
      const out: TrafficSourceStatus[] = [];
      for (const source of sources.values()) {
        out.push({ ...source.projection, state: source.state, stats: source.consumer.stats() });
      }
      return out;
    },
    records(uid) {
      const source = sources.get(uid);
      if (source === undefined) return null;
      return source.ring.snapshot();
    },
    dispose() {
      for (const uid of [...sources.keys()]) disarm(uid);
    },
  };
}
