/**
 * Capture-session vocabulary — the disk tier of the storage model
 * (the agent-traffic plan §3, rebuilt to §11 in Phase C). A capture
 * session is the ONLY path by which observed traffic ever reaches disk,
 * and every property of that path is deliberate:
 *
 *   - **Human-initiated, never agent-initiated.** Sessions start from
 *     the operator plane (`oh.daemon.traffic.capture.start`) or a UI
 *     gesture — no MCP tool can start or stop one, so an agent cannot
 *     turn an in-memory grant into a durable one.
 *   - **Raw at rest, redacted at read (§11.5).** `formatVersion 2`
 *     records the wire-plane event log at full fidelity — the reducer
 *     INPUT, so replay re-runs the live reducers. Redaction moved from
 *     write time to read time: the store and its raw event types stay
 *     private to the host packages, and every consumer-facing read is
 *     a projection with an explicit policy. Sealed artifacts are
 *     encrypted with an app-held key (§9.5); the {@link
 *     TrafficCaptureSessionProjection.encrypted} stamp is honest when
 *     no key was available.
 *   - **Bounded.** Event-log size and duration bounds ride the session
 *     from start; a session that trips a bound STOPS and says so
 *     ({@link TrafficCaptureEndReason}), never silently truncates. A
 *     global retention budget prunes sealed sessions oldest-first
 *     ({@link DEFAULT_TRAFFIC_SESSION_RETENTION}).
 */

import type { LifecycleSource } from '../request-lifecycle/wire';

/** Hard bounds one capture session carries from start. `maxBytes`
 *  bounds the session's EVENT LOG — bodies travel out-of-line through
 *  the content-addressed blob store and count against the global
 *  retention budget instead. */
export interface TrafficCaptureBounds {
  readonly maxBytes: number;
  readonly maxDurationMs: number;
}

/** Production defaults — sized for "reproduce this overnight": the
 *  duration bound outlives a work day, the byte bound keeps one
 *  session's log from eating a disk (bodies live in the shared blob
 *  store, deduplicated). E2E drives tiny overrides through the start
 *  call. */
export const DEFAULT_TRAFFIC_CAPTURE_BOUNDS: TrafficCaptureBounds = {
  maxBytes: 64 * 1024 * 1024,
  maxDurationMs: 24 * 60 * 60 * 1000,
};

/** Global retention posture for the sessions archive (§11.4): dedup
 *  slows growth, this bounds it. Sealed sessions are pruned
 *  oldest-first once the archive (logs + reachable blobs) crosses the
 *  budget; the recording session is never pruned. Surfaced in Settings
 *  with the arm defaults (C4). */
export interface TrafficSessionRetention {
  readonly maxTotalBytes: number;
}

export const DEFAULT_TRAFFIC_SESSION_RETENTION: TrafficSessionRetention = {
  maxTotalBytes: 2 * 1024 * 1024 * 1024,
};

/**
 * How a session ended. `stopped` is the explicit human gesture;
 * `size-bound` / `duration-bound` are bound trips (the session STOPPED,
 * honestly — nothing was silently dropped); `source-disarmed` is the
 * absence cascade (disarming a source stops its capture); `write-error`
 * is a failed disk write (disk full, permissions) — the session stops
 * rather than pretending to record; `crashed` is stamped at boot on a
 * session a dead process left recording — everything appended before
 * the crash is preserved and sealed.
 */
export type TrafficCaptureEndReason =
  | 'stopped'
  | 'size-bound'
  | 'duration-bound'
  | 'source-disarmed'
  | 'write-error'
  | 'crashed';

/** The planes a session's event log carries (§11.1). C3 records the
 *  lifecycle plane; console/storage join the converged store with a
 *  later slice and stamp themselves here — the viewer renders what the
 *  manifest declares and never overpromises. */
export type TrafficSessionPlane = 'lifecycle' | 'console' | 'storage';

/**
 * One capture session, projected for operator surfaces. `state` walks
 * `recording` → `sealing` (stop accepted, the log is being compressed
 * and encrypted) → `sealed`; `endReason` is set from `sealing` onward.
 */
export interface TrafficCaptureSessionProjection {
  readonly sessionId: string;
  /** The armed source this session records. */
  readonly sourceUid: string;
  /** Operator-chosen session name (also part of the directory name). */
  readonly name: string;
  /** Absolute path of the session's directory (event log + meta). */
  readonly dirPath: string;
  readonly startedAtMs: number;
  readonly bounds: TrafficCaptureBounds;
  readonly planes: ReadonlyArray<TrafficSessionPlane>;
  /** Requests recorded — the count of `started` events in the log. */
  readonly requests: number;
  /** Event lines appended so far. */
  readonly events: number;
  /** Event-log bytes written (plain, pre-seal) — the `maxBytes` meter. */
  readonly bytesWritten: number;
  /** Whether sealed artifacts (log + blobs) are encrypted with the
   *  app-held key. `false` = no key was available on this host; the
   *  stamp keeps the downgrade visible, never silent. */
  readonly encrypted: boolean;
  readonly state: 'recording' | 'sealing' | 'sealed';
  readonly stoppedAtMs?: number;
  readonly endReason?: TrafficCaptureEndReason;
}

/**
 * One ARCHIVED session's index row, projected for the Sessions tool
 * window (§11.1) — every session on disk, prior runs included, read
 * from the archive's boot-scan meta index. Identity is the session
 * DIRECTORY basename (`<iso-stamp>-<slug>-<sessionId>`): unlike
 * `sessionId` (`cap-<seq>`, which restarts per process) it is
 * collision-proof across runs, and it is what the organize/delete
 * verbs key on. Human/operator surface only — no MCP mirror exists
 * for any archive read or verb until the C7 session tier.
 */
export interface TrafficArchivedSessionProjection {
  /** Archive-wide identity — the session directory basename. */
  readonly id: string;
  /** The per-run id the recording projection carried. */
  readonly sessionId: string;
  /** Display name — the start name (a browser tab's title at the
   *  capture gesture); a blank one is stamped with the dominant
   *  origin's registrable domain at seal. Date, counts and fidelity
   *  are NOT part of the name — surfaces derive that chrome from the
   *  row's own fields. Data, not chrome, so never localized. */
  readonly name: string;
  /** Organize collection (§11.1 auto-placement: browser-tab sessions
   *  under the dominant origin's registrable domain, proxy sessions
   *  under the fixed wire collection). Absent = filed nowhere.
   *  Reorganizing rewrites one meta atomically and never moves any
   *  other session. */
  readonly collection?: string;
  /** Organize folder inside the collection — user-created only, never
   *  auto-stamped. Absent = directly under the collection. */
  readonly folder?: string;
  readonly sourceKind: string;
  readonly sourceLabel: string;
  readonly state: 'recording' | 'sealing' | 'sealed';
  readonly startedAtMs: number;
  readonly stoppedAtMs?: number;
  readonly endReason?: TrafficCaptureEndReason;
  readonly requests: number;
  /** Requests that failed or answered with a 4xx/5xx status. */
  readonly errors: number;
  readonly events: number;
  /** Honest footprint on disk: the sealed (or still-plain) event log
   *  plus the blob bytes THIS session stored (dedup accounting — blobs
   *  other sessions already held cost it nothing). */
  readonly sizeBytes: number;
  readonly encrypted: boolean;
  /** Last observed provenance — the §11.1 fidelity stamp. */
  readonly fidelity: LifecycleSource;
  readonly planes: ReadonlyArray<TrafficSessionPlane>;
  readonly origins: ReadonlyArray<string>;
  /** The lifecycle partition the recorded envelopes address — what a
   *  replay viewer passes as its view's tab id (the recorded frames
   *  carry it verbatim; the reserved proxy sentinel for proxy
   *  sessions). */
  readonly partitionTabId: number;
}
