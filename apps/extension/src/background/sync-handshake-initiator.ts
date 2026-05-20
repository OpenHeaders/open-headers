/**
 * Extension-side initiator for the state-vector handshake — Phase C
 * wire-up of `docs/DATA_PLANE_TOPOLOGIES.md §11.1`.
 *
 * One instance per extension service-worker lifetime. Drives the FSM
 *
 *   `idle → hello-sent → welcomed → catching-up → synced`
 *
 * on each WS reconnect:
 *
 *   1. `start()` fires HELLO (with the SW's nodeId + active workspaceId)
 *      and STATE_VECTOR (folded from the local mutation log).
 *   2. The responder streams a SNAPSHOT (cold path) and/or
 *      MUTATION frames (delta path), then SYNCED.
 *   3. On SYNCED the initiator runs the canonical C16 trigger:
 *      `applyPeerStateVectorToPendingOut(stateVectorAfter)` to drop
 *      already-applied entries, then `flushPendingOutToBackend()` to
 *      replay anything the peer is still missing.
 *
 * **What this module owns:**
 *
 *   - The four handshake message types (HELLO outbound; WELCOME +
 *     SNAPSHOT + SYNCED inbound). STATE_VECTOR is outbound only — the
 *     responder side (desktop main) emits the stream and SYNCED.
 *   - The transient FSM state for telemetry / status pill.
 *
 * **What this module does NOT own:**
 *
 *   - Mutation streaming envelopes (`oh.sync.mutation` /
 *     `oh.sync.mutationBatch`) — those go to {@link handleIncomingMutationFrame}
 *     unchanged. Mid-handshake mutation frames apply through the same
 *     path; HLC dedup handles overlap with the snapshot.
 *   - WS transport plumbing (connect / reconnect / ping) — owned by
 *     `websocket.ts`.
 *   - Mode-switch / workspace-collision UX (W1-W3 / M1-M7).
 *
 * The factory takes everything it needs as dependencies so the module
 * tests in isolation without touching the websocket layer or the
 * oracle.
 */
import {
  HANDSHAKE_ROLES,
  PROTOCOL_VERSION,
  SYNC_HELLO_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  SYNC_SYNCED_TYPE,
  SYNC_WELCOME_TYPE,
  SYNC_SNAPSHOT_TYPE,
  SyncSnapshotMessageSchema,
  SyncSyncedMessageSchema,
  SyncWelcomeMessageSchema,
  type HandshakeRejectReason,
  type SyncHelloMessage,
  type SyncStateVectorMessage,
  type WorkspaceSnapshot,
} from '@openheaders/core/protocol';
import type { Org } from '@openheaders/core/types';
import type { StateVector } from '@openheaders/core/sync';
import * as v from 'valibot';

import { logger } from '@utils/logger';

const SCOPE = 'SyncHandshakeInitiator';

export type InitiatorState =
  | 'idle'
  | 'hello-sent'
  | 'welcomed'
  | 'catching-up'
  | 'synced'
  // Terminal failure states. Distinct shapes so the status reporter
  // renders the right pill colour + message without parsing a string.
  | 'rejected' // peer rejected our HELLO; details via rejectReason()
  | 'timed-out' // local timer fired before SYNCED arrived
  | 'failed' // catch-up application error; detail via failureDetail()
  | 'aborted'; // no active workspace at start() time

/** Default handshake timeout — generous enough for a large snapshot, tight enough to surface a dead wire. */
export const DEFAULT_HANDSHAKE_TIMEOUT_MS = 10_000;

export interface SyncHandshakeInitiatorDeps {
  /** Write one frame to the backend. Returns false if the wire is gone. */
  readonly send: (frame: object) => boolean;
  /** Reads the active workspace id; returns null when no workspace is selected. */
  readonly getActiveWorkspaceId: () => string | null;
  /** Reads the SW's HLC writer identity for `workspaceId`. */
  readonly getExtensionNodeId: (workspaceId: string) => string;
  /** Diagnostic agent string (e.g. `'@openheaders/extension@5.0.0'`). */
  readonly getExtensionAgent: () => string;
  /**
   * Returns the long-lived daemon auth token the user pasted into
   * settings, or null when none is configured. Sent on every HELLO so
   * daemons bound non-loopback can validate the peer (U3.2). Loopback
   * daemons ignore the field; passing a token to a loopback peer is
   * harmless.
   */
  readonly getAuthToken?: () => string | null;
  /** Folds the local log into a state vector. */
  readonly readStateVector: (workspaceId: string) => Promise<StateVector>;
  /** Applies an inbound snapshot blob to local stores. */
  readonly applySnapshot: (snapshot: WorkspaceSnapshot) => Promise<void>;
  /**
   * Fires when the responder reports SYNCED. The initiator passes the
   * peer's `stateVectorAfter` so the wiring can prune + flush the
   * pending-out queue (Phase C C16).
   */
  readonly onSynced: (peerVector: StateVector) => Promise<void>;
  /** Optional — fired on a rejected WELCOME so the UI can surface the reason. */
  readonly onRejected?: (reason: HandshakeRejectReason, detail?: string) => void;
  /**
   * Optional — fired on an accepted WELCOME that carries the backend's
   * home `Org` (Phase U5.2 "consume-first join"). The wiring records the
   * Org into this host's authorized set (`recordJoinedOrg`) so the
   * backend's workspaces sync down. Awaited before the next handshake
   * frame is processed so the catch-up snapshot/deltas aren't dropped
   * by the receiver-side org filter.
   *
   * `backendActiveWorkspaceId` is the backend's currently-active
   * workspace (Phase U5.9 "join → adopt") when the WELCOME carries it —
   * the wiring adopts it as the active workspace once it has synced
   * down. Absent when the backend has no active workspace.
   */
  readonly onJoinedOrg?: (org: Org, backendActiveWorkspaceId?: string) => Promise<void>;
  /**
   * Wall-clock budget between HELLO and SYNCED. After the budget
   * elapses the FSM transitions to `timed-out`. Defaults to
   * {@link DEFAULT_HANDSHAKE_TIMEOUT_MS}.
   */
  readonly timeoutMs?: number;
  /** Test seam — swap setTimeout / clearTimeout for fake timers. */
  readonly setTimer?: (fn: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

export interface SyncHandshakeInitiator {
  /** Current FSM phase — read by the status pill / diagnostics. */
  state(): InitiatorState;
  /** Most-recent rejection reason; null unless `state() === 'rejected'`. */
  rejectReason(): HandshakeRejectReason | null;
  /** Detail message for a `failed` terminal state (e.g. catch-up apply error). */
  failureDetail(): string | null;
  /** True iff `frame` is a handshake-flow type the initiator handles. */
  handles(frame: unknown): boolean;
  /** Process one inbound handshake frame. No-op for non-handshake frames. */
  handle(frame: unknown): Promise<void>;
  /** Send HELLO + STATE_VECTOR. Idempotent within one WS lifetime. */
  start(): Promise<void>;
  /** Reset to `idle` — called by the WS layer on socket close so the next open re-runs the handshake. */
  reset(): void;
  /**
   * Register an observer that fires on every state transition (after
   * the FSM commits the new state). Returns an unsubscribe function.
   * Subscribers MUST NOT throw — exceptions are caught + logged so a
   * misbehaving subscriber can't wedge the FSM.
   */
  subscribe(cb: (state: InitiatorState) => void): () => void;
}

const HANDSHAKE_INBOUND_TYPES: ReadonlySet<string> = new Set([
  SYNC_WELCOME_TYPE,
  SYNC_SNAPSHOT_TYPE,
  SYNC_SYNCED_TYPE,
  // Server-only types are listed so we own the routing decision rather
  // than letting them flow through to the mutation receiver (which
  // would log a malformed-frame warning).
  SYNC_HELLO_TYPE,
  SYNC_STATE_VECTOR_TYPE,
]);

/** Terminal states — `handle()` and `start()` short-circuit when reached. */
const TERMINAL_STATES: ReadonlySet<InitiatorState> = new Set(['rejected', 'timed-out', 'failed', 'aborted', 'synced']);

export function createSyncHandshakeInitiator(deps: SyncHandshakeInitiatorDeps): SyncHandshakeInitiator {
  let state: InitiatorState = 'idle';
  let rejectReason: HandshakeRejectReason | null = null;
  let failureDetail: string | null = null;
  let timeoutHandle: unknown = null;

  const subscribers = new Set<(state: InitiatorState) => void>();
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const timeoutMs = deps.timeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS;

  function clearHandshakeTimer(): void {
    if (timeoutHandle !== null) {
      clearTimer(timeoutHandle);
      timeoutHandle = null;
    }
  }

  function transition(next: InitiatorState): void {
    if (state === next) return;
    logger.debug(SCOPE, `${state} → ${next}`);
    state = next;
    if (TERMINAL_STATES.has(next)) clearHandshakeTimer();
    for (const cb of [...subscribers]) {
      try {
        cb(next);
      } catch (err) {
        logger.warn(SCOPE, 'subscriber threw', err);
      }
    }
  }

  function startHandshakeTimer(): void {
    clearHandshakeTimer();
    timeoutHandle = setTimer(() => {
      timeoutHandle = null;
      // Only fire the timeout if we're still mid-handshake; terminal
      // states (the responder beat the timer) leave the FSM alone.
      if (state === 'hello-sent' || state === 'welcomed' || state === 'catching-up') {
        logger.warn(SCOPE, `handshake timed out after ${timeoutMs}ms in state ${state}`);
        transition('timed-out');
      }
    }, timeoutMs);
  }

  async function start(): Promise<void> {
    if (
      state === 'hello-sent' ||
      state === 'welcomed' ||
      state === 'catching-up' ||
      state === 'synced'
    ) {
      // Already mid-handshake or done for this socket lifetime.
      return;
    }
    rejectReason = null;
    failureDetail = null;
    const workspaceId = deps.getActiveWorkspaceId();
    if (!workspaceId) {
      logger.info(SCOPE, 'no active workspace — skipping handshake');
      transition('aborted');
      return;
    }
    const nodeId = deps.getExtensionNodeId(workspaceId);
    const authToken = deps.getAuthToken?.() ?? null;
    const hello: SyncHelloMessage = {
      type: SYNC_HELLO_TYPE,
      protocolVersion: PROTOCOL_VERSION,
      role: HANDSHAKE_ROLES.EXTENSION,
      nodeId,
      workspaceId,
      agent: deps.getExtensionAgent(),
      ...(authToken ? { authToken } : {}),
    };
    if (!deps.send(hello)) {
      logger.warn(SCOPE, 'HELLO send failed — wire gone');
      transition('aborted');
      return;
    }
    transition('hello-sent');
    startHandshakeTimer();
    let perNodeMaxHlc: StateVector;
    try {
      perNodeMaxHlc = await deps.readStateVector(workspaceId);
    } catch (err) {
      logger.warn(SCOPE, 'readStateVector failed; aborting handshake', err);
      transition('aborted');
      return;
    }
    const stateVector: SyncStateVectorMessage = {
      type: SYNC_STATE_VECTOR_TYPE,
      workspaceId,
      perNodeMaxHlc,
    };
    if (!deps.send(stateVector)) {
      logger.warn(SCOPE, 'STATE_VECTOR send failed — wire gone');
      transition('aborted');
    }
  }

  function handles(frame: unknown): boolean {
    if (!frame || typeof frame !== 'object') return false;
    const t = (frame as { type?: unknown }).type;
    return typeof t === 'string' && HANDSHAKE_INBOUND_TYPES.has(t);
  }

  async function handle(frame: unknown): Promise<void> {
    if (!frame || typeof frame !== 'object') return;
    // Late frames after a terminal state are dropped — re-entry would
    // confuse subscribers. Reconnect runs `reset()` to clear back to
    // `idle` for the next handshake.
    if (TERMINAL_STATES.has(state)) return;
    const t = (frame as { type?: unknown }).type;
    if (t === SYNC_WELCOME_TYPE) {
      await handleWelcome(frame);
      return;
    }
    if (t === SYNC_SNAPSHOT_TYPE) {
      await handleSnapshot(frame);
      return;
    }
    if (t === SYNC_SYNCED_TYPE) {
      await handleSynced(frame);
      return;
    }
    if (t === SYNC_HELLO_TYPE || t === SYNC_STATE_VECTOR_TYPE) {
      logger.warn(SCOPE, `received server-only frame ${String(t)}; dropping`);
    }
  }

  async function handleWelcome(frame: object): Promise<void> {
    const parsed = v.safeParse(SyncWelcomeMessageSchema, frame);
    if (!parsed.success) {
      logger.warn(SCOPE, 'malformed WELCOME; dropping', parsed.issues);
      return;
    }
    if (parsed.output.accepted) {
      // U5.2 — fold the backend's home Org into this host's authorized
      // set before catch-up frames arrive, so the snapshot/deltas the
      // responder streams aren't dropped by the receiver-side org
      // filter. A throw here is logged but never fails the handshake —
      // the org filter degrades to "drop until the next reconnect
      // re-sends WELCOME," not a desync.
      const { org, activeWorkspaceId } = parsed.output;
      if (org && deps.onJoinedOrg) {
        try {
          await deps.onJoinedOrg(org, activeWorkspaceId);
        } catch (err) {
          logger.warn(SCOPE, 'onJoinedOrg threw — backend Org not recorded', err);
        }
      }
      transition('welcomed');
      return;
    }
    rejectReason = parsed.output.reason;
    transition('rejected');
    logger.warn(SCOPE, `handshake rejected: ${parsed.output.reason} ${parsed.output.detail ?? ''}`);
    deps.onRejected?.(parsed.output.reason, parsed.output.detail);
  }

  async function handleSnapshot(frame: object): Promise<void> {
    const parsed = v.safeParse(SyncSnapshotMessageSchema, frame);
    if (!parsed.success) {
      logger.warn(SCOPE, 'malformed SNAPSHOT; dropping', parsed.issues);
      return;
    }
    if (state === 'welcomed') transition('catching-up');
    try {
      await deps.applySnapshot(parsed.output.snapshot as unknown as WorkspaceSnapshot);
    } catch (err) {
      const message = (err as Error)?.message ?? String(err);
      logger.warn(SCOPE, 'applySnapshot threw — catch-up failed', err);
      failureDetail = `snapshot apply failed: ${message}`;
      transition('failed');
    }
  }

  async function handleSynced(frame: object): Promise<void> {
    const parsed = v.safeParse(SyncSyncedMessageSchema, frame);
    if (!parsed.success) {
      logger.warn(SCOPE, 'malformed SYNCED; dropping', parsed.issues);
      return;
    }
    try {
      await deps.onSynced(parsed.output.stateVectorAfter);
    } catch (err) {
      const message = (err as Error)?.message ?? String(err);
      logger.warn(SCOPE, 'onSynced threw — catch-up post-flush failed', err);
      failureDetail = `post-sync flush failed: ${message}`;
      transition('failed');
      return;
    }
    transition('synced');
  }

  function reset(): void {
    clearHandshakeTimer();
    state = 'idle';
    rejectReason = null;
    failureDetail = null;
    for (const cb of [...subscribers]) {
      try {
        cb(state);
      } catch (err) {
        logger.warn(SCOPE, 'subscriber threw on reset', err);
      }
    }
  }

  function subscribe(cb: (state: InitiatorState) => void): () => void {
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  }

  return {
    state: () => state,
    rejectReason: () => rejectReason,
    failureDetail: () => failureDetail,
    handles,
    handle,
    start,
    reset,
    subscribe,
  };
}
