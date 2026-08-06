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
 *
 * S7 added capture sessions (the disk tier); C3 rebuilt them on the
 * §11 sessions archive — per-source lifecycle still, so disarm stops
 * the recording:
 *
 *   - **Human-initiated only.** `captureStart` is reachable from the
 *     operator plane alone; no MCP tool starts or stops a session, so
 *     an agent cannot turn an in-memory grant into a durable one.
 *     Agents may SEE that a source is capturing (an honest marker on
 *     `traffic_sources` rows), never drive it.
 *   - **The recorder is an envelope tee, not a ring subscriber** (§10,
 *     §11.3): the source connection's verbatim wire stream — the
 *     reducer INPUT — is offered to the active recording session
 *     BEFORE the body/consumer routing split, so the session records
 *     exactly what the fold consumed and replay re-runs the reducers.
 *   - **Raw at rest, redacted at read** (§11.5): the session store
 *     holds full fidelity; redaction moved to the projection layer of
 *     every consumer-facing read. The store and its raw types stay
 *     private to the host packages.
 *   - **An active recording holds the arm.** "Reproduce this
 *     overnight" must survive a quiet night: the expiry sweep skips a
 *     source whose session is recording — the session's own duration
 *     bound is the backstop — and the arm's idle clock restarts when
 *     the session ends.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { PROXY_LIFECYCLE_TAB_ID } from '@openheaders/core/proxy';
import type { LifecycleSource, LifecycleWireMessage } from '@openheaders/core/request-lifecycle';
import type {
  TrafficBodyProjection,
  TrafficCaptureBounds,
  TrafficCaptureSessionProjection,
  TrafficRecordProjection,
  TrafficRetentionStats,
  TrafficSourceProjection,
} from '@openheaders/core/traffic';
import { DEFAULT_TRAFFIC_CAPTURE_BOUNDS } from '@openheaders/core/traffic';
import type { InspectorHarBody } from '@openheaders/core/types';
import type { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import {
  DEFAULT_TRAFFIC_RETENTION_BOUNDS,
  projectPulledBody,
  type TrafficRetentionBounds,
  TrafficRetentionConsumer,
  TrafficRetentionRing,
} from '@openheaders/oracle/traffic-retention';

import type { TrafficPartitionMirror } from './partition-mirror';
import type { TrafficSessionArchive } from './session-archive';
import type { TrafficSessionRecording } from './session-recorder';
import { connectBrowserTabSource, connectProxySource, type TrafficSourceConnection } from './sources';

const SCOPE = 'TrafficTap';

/** Default arm lifetime; observe reads extend it by the same span. */
export const DEFAULT_TRAFFIC_ARM_TTL_MS = 30 * 60 * 1000;

/** Hard ceiling on one reveal escalation window (PLAN §4: time-boxed). */
export const MAX_TRAFFIC_REVEAL_TTL_MS = 15 * 60 * 1000;

/** Cadence of the lapsed-source sweep. */
const EXPIRY_SWEEP_INTERVAL_MS = 30 * 1000;

/** Ended capture sessions kept readable on the status surface — the
 *  operator's "what did that session do" answer without a disk scan. */
const STOPPED_CAPTURES_KEPT = 20;

/** Bounded wait on one on-demand body pull. The engine answers a pull
 *  it cannot satisfy with silence (never an error frame), so absence of
 *  a `body-attached` inside this window IS the unavailability signal. */
export const TRAFFIC_BODY_PULL_TIMEOUT_MS = 10 * 1000;

export interface TrafficTapDeps {
  /** The partition mirror (C2) — browser-tab sources join it as tap
   *  seats instead of dialing the relay themselves. */
  readonly mirror: TrafficPartitionMirror;
  /** The daemon-side proxy-capture hub (`proxyCaptureService.hub`). */
  readonly proxyHub: RequestLifecycleHub;
  /** `proxyCaptureService.serveRequestBody` — the proxy partition's
   *  body plane. Absent ⇒ proxy pulls answer with silence. */
  readonly proxyServeRequestBody?: (requestId: string, hopIndex: number) => void;
  /** The sessions archive (§11.4 — the ONLY path traffic ever takes
   *  to disk). Absent ⇒ `captureStart` refuses. */
  readonly archive?: TrafficSessionArchive;
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
  /** The ACTIVE capture session recording this source (S7), when one
   *  is — the retention-indicator surfaces render from this. Ended
   *  sessions live on {@link TrafficTap.captureSessions} instead. */
  readonly capture?: TrafficCaptureSessionProjection;
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

export interface TrafficCaptureStartOptions {
  readonly name: string;
  readonly bounds?: Partial<TrafficCaptureBounds>;
}

export type TrafficCaptureStartRefusal = 'unknown-source' | 'capture-active' | 'capture-unavailable';

export type TrafficCaptureStartResult =
  | { readonly ok: true; readonly session: TrafficCaptureSessionProjection }
  | { readonly ok: false; readonly reason: TrafficCaptureStartRefusal };

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
  /**
   * Start one capture session on an armed source (S7). Human gesture
   * only — reachable from the operator plane, never a tool. One active
   * session per source; the arm cannot lapse while it runs; disarm
   * stops it (`source-disarmed`). Refuses without throwing.
   */
  captureStart(uid: string, options: TrafficCaptureStartOptions): TrafficCaptureStartResult;
  /** Stop the source's active capture session. Idempotent: the ended
   *  session's projection, or `null` when nothing was capturing (an
   *  unknown uid is indistinguishable — absence semantics). */
  captureStop(uid: string): TrafficCaptureSessionProjection | null;
  /** Every session this tap started — active first, then the last
   *  {@link STOPPED_CAPTURES_KEPT} ended ones, newest-ended last. */
  captureSessions(): TrafficCaptureSessionProjection[];
  /**
   * Subscribe to source/capture state transitions: arm, disarm (idle
   * expiry included), a refused watch, capture start/stop, and a
   * stopped session's seal completing. Fired AFTER the transition
   * commits, so a listener reading `status()` / `captureSessions()`
   * sees the new state — the invalidation feed UI surfaces re-read on
   * instead of polling. Returns the unsubscribe.
   */
  onStatusChanged(listener: () => void): () => void;
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
  /** The source's recording session (§11) — at most one; stopped
   *  sessions move to the tap-level ended list and this resets to
   *  null. */
  capture: TrafficSessionRecording | null;
  /** Latest wire-observed provenance — the recorder's fidelity stamp
   *  when a session starts mid-arm. */
  lastProvenance: LifecycleSource;
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

/** Whether the record's own facts say a response body existed — the
 *  measured byte count when a fidelity plane recorded one, the
 *  Content-Length header otherwise. Decides the honest reason for an
 *  empty pull answer: bytes were observed ⇒ the body is `gone`;
 *  otherwise there was never body content to serve. */
function recordIndicatesBody(record: TrafficRecordProjection): boolean {
  if (record.bodyBytes !== undefined) return record.bodyBytes > 0;
  const contentLength = record.responseHeaders?.find((header) => header.name.toLowerCase() === 'content-length');
  if (contentLength === undefined) return false;
  const bytes = Number.parseInt(contentLength.value, 10);
  return Number.isFinite(bytes) && bytes > 0;
}

interface RecordWaiter {
  readonly match: (record: TrafficRecordProjection) => boolean;
  readonly settle: (result: TrafficWaitResult) => void;
}

export function createTrafficTap(deps: TrafficTapDeps): TrafficTap {
  const sources = new Map<string, ArmedSource>();
  /** Ended recordings, kept as HANDLES: a stopped session keeps
   *  sealing in the background, so the status surface projects live
   *  state (`sealing` → `sealed`) instead of a stale snapshot. */
  const stoppedCaptures: TrafficSessionRecording[] = [];
  let captureSeq = 0;
  const statusListeners = new Set<() => void>();

  /** One post-commit tick per source/capture transition — the
   *  invalidation feed the workbench's rail converges on. */
  function notifyStatusChanged(): void {
    for (const listener of [...statusListeners]) listener();
  }

  /** An ended session leaves the source and joins the bounded ended
   *  list; the arm's idle clock restarts so a source held warm by its
   *  capture does not lapse the instant the session stops. */
  function retireCapture(source: ArmedSource): void {
    const capture = source.capture;
    if (capture === null) return;
    source.capture = null;
    stoppedCaptures.push(capture);
    while (stoppedCaptures.length > STOPPED_CAPTURES_KEPT) stoppedCaptures.shift();
    source.expiresAtMs = Date.now() + source.ttlMs;
    notifyStatusChanged();
  }

  function disarm(uid: string): boolean {
    const source = sources.get(uid);
    if (source === undefined) return false;
    // Absence cascades: a source that stops existing stops its capture.
    source.capture?.stop('source-disarmed');
    retireCapture(source);
    source.connection?.close();
    source.bodyWaiters.clear();
    // Settle live waits before dropping the source — a disarm (or lapse)
    // mid-wait answers honestly instead of leaving a promise pending.
    const waiters = [...source.recordWaiters];
    source.recordWaiters.clear();
    for (const waiter of waiters) waiter.settle({ ok: false, reason: 'source-disarmed' });
    sources.delete(uid);
    logger.info(SCOPE, `disarmed ${uid}`);
    notifyStatusChanged();
    return true;
  }

  /** The consumer's admission/refinement seam: evaluate pending wait
   *  predicates (S4). The recorder no longer rides this seam — it tees
   *  the envelope stream itself (§11.3). */
  function notifyRecord(uid: string, tabId: number, requestId: string): void {
    const source = sources.get(uid);
    if (source === undefined) return;
    if (source.recordWaiters.size === 0) return;
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
      // An active capture holds the arm: "reproduce this overnight"
      // must survive a quiet night, and the session's own duration
      // bound is the backstop the idle heuristic would otherwise cut.
      if (source.capture?.active === true) continue;
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
   *  the consumer's request stamp — an unrequested body is dropped).
   *  The recorder already saw the envelope verbatim on the tee. */
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

  /** The one envelope seam every source transport feeds (§11.3): tee
   *  the verbatim stream to an active recording session FIRST — the
   *  session records the reducer INPUT — then route `body-attached`
   *  to the body plane and everything else to the retention fold. */
  function handleEnvelope(uid: string, message: LifecycleWireMessage): void {
    const source = sources.get(uid);
    if (source === undefined) return;
    if (message.kind === 'source') source.lastProvenance = message.source;
    const capture = source.capture;
    if (capture !== null) {
      capture.appendEnvelope(message);
      if (!capture.active) retireCapture(source);
    }
    if (message.kind === 'lifecycle-update' && message.update.kind === 'body-attached') {
      handleBodyAttached(uid, message.update.requestId, message.update.hopIndex, message.update.body);
      return;
    }
    source.consumer.handle(message);
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
          if (live !== undefined) {
            live.state = 'refused';
            notifyStatusChanged();
          }
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
      capture: null,
      lastProvenance: 'heuristic',
    };
    // Registered BEFORE the dial: a synchronously-answering acceptor
    // delivers `ready` (+ any replay) inside the connect call, and the
    // envelope seam resolves this source through the registry.
    sources.set(uid, source);
    const connection = connectBrowserTabSource({
      mirror: deps.mirror,
      nodeId,
      tabId,
      onEnvelope: (message) => handleEnvelope(uid, message),
    });
    if (connection === null) {
      sources.delete(uid);
      logger.warn(SCOPE, `arm refused for ${uid} — no acceptor claimed the qualified lifeline`);
      return null;
    }
    source.connection = connection;
    logger.info(SCOPE, `armed ${uid}`);
    notifyStatusChanged();
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
      capture: null,
      lastProvenance: 'proxy',
    };
    sources.set(uid, source);
    source.connection = connectProxySource({
      hub: deps.proxyHub,
      onEnvelope: (message) => handleEnvelope(uid, message),
      ...(deps.proxyServeRequestBody !== undefined ? { serveBody: deps.proxyServeRequestBody } : {}),
    });
    logger.info(SCOPE, `armed ${uid}`);
    notifyStatusChanged();
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
    captureStart(uid, options) {
      sweepExpired();
      const source = sources.get(uid);
      if (source === undefined) return { ok: false, reason: 'unknown-source' };
      if (source.capture?.active === true) return { ok: false, reason: 'capture-active' };
      const archive = deps.archive;
      if (archive === undefined) return { ok: false, reason: 'capture-unavailable' };
      captureSeq++;
      const sessionId = `cap-${captureSeq}`;
      let session: TrafficSessionRecording;
      try {
        session = archive.start({
          sessionId,
          sourceUid: uid,
          sourceKind: source.projection.kind,
          sourceLabel: source.projection.label,
          name: options.name,
          partitionTabId: source.partitionTabId,
          initialFidelity: source.lastProvenance,
          bounds: {
            maxBytes: options.bounds?.maxBytes ?? DEFAULT_TRAFFIC_CAPTURE_BOUNDS.maxBytes,
            maxDurationMs: options.bounds?.maxDurationMs ?? DEFAULT_TRAFFIC_CAPTURE_BOUNDS.maxDurationMs,
          },
          // Wire honesty (§11.4): the recorder pulls every response
          // body at completion, over the SAME source connection the
          // tap owns — the `body-attached` answer feeds every reader.
          pullBody: (requestId, hopIndex) => {
            sources.get(uid)?.connection?.requestBody(requestId, hopIndex);
          },
          // A bound trip or write failure stops the session from inside
          // an append or its own timer — retire it here so the status
          // surface converges without waiting for the next seam event.
          onAutoStop: () => {
            const live = sources.get(uid);
            if (live !== undefined) retireCapture(live);
          },
          // A stopped session seals in the background — the completed
          // seal is a projection transition (`sealing` → `sealed`) the
          // invalidation feed must carry like any other.
          onSealed: () => notifyStatusChanged(),
        });
      } catch (err) {
        logger.warn(SCOPE, `capture start failed for ${uid}: ${(err as Error).message}`);
        return { ok: false, reason: 'capture-unavailable' };
      }
      source.capture = session;
      notifyStatusChanged();
      return { ok: true, session: session.projection() };
    },
    captureStop(uid) {
      const source = sources.get(uid);
      const capture = source?.capture ?? null;
      if (source === undefined || capture === null) return null;
      capture.stop();
      retireCapture(source);
      return capture.projection();
    },
    captureSessions() {
      const active: TrafficCaptureSessionProjection[] = [];
      for (const source of sources.values()) {
        if (source.capture !== null) active.push(source.capture.projection());
      }
      return [...active, ...stoppedCaptures.map((session) => session.projection())];
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
          ...(source.capture !== null ? { capture: source.capture.projection() } : {}),
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
      // The engine's universal "no body to show" signal: an unknown or
      // evicted request, or a body the host dropped, answers as an EMPTY
      // body, never an error frame (cdp-body-synth.ts) — projecting it
      // as a real empty body would mask decay. The record's own size
      // facts pick the honest reason.
      if (answer.content === '') {
        return { ok: false, reason: recordIndicatesBody(record) ? 'gone' : 'no-response-body' };
      }
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
    onStatusChanged(listener) {
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    },
    dispose() {
      clearInterval(sweepTimer);
      for (const uid of [...sources.keys()]) disarm(uid);
      statusListeners.clear();
    },
  };
}
