/**
 * Extension-side handshake coordinator — Phase C / U6.3 wire-up of
 * `docs/DATA_PLANE_TOPOLOGIES.md §11.1`.
 *
 * One instance per extension service-worker lifetime. The handshake is
 * split across two sub-FSMs (U6.3 Part B):
 *
 *   - {@link createConnectionHandshake} — the HELLO/WELCOME exchange,
 *     run once per socket. Owns auth + the `onJoinedOrg` Org join.
 *   - {@link createScopeCatchupDriver} — the per-scope
 *     STATE_VECTOR → SNAPSHOT/MUTATION → SYNCED catch-up, run once per
 *     sync scope.
 *
 * On WS connect this coordinator runs the connection handshake; once it
 * reaches `connected` the coordinator kicks off the `__global__`
 * workspace-list scope's catch-up so the backend's workspaces sync down
 * (U6.3). The per-consumed-workspace fan-out (U6.4) sequences further
 * `start(scope)` calls over the same socket.
 *
 * The coordinator presents a single {@link InitiatorState} to the
 * status pill / diagnostics by composing the two sub-FSM states — the
 * connection phase up to `connected`, then the catch-up phase.
 *
 * **What this module does NOT own:**
 *
 *   - Mutation streaming envelopes (`oh.sync.mutation` /
 *     `oh.sync.mutationBatch`) — those go to the mutation receiver
 *     unchanged. HLC dedup handles overlap with the snapshot.
 *   - WS transport plumbing (connect / reconnect / ping) — owned by
 *     `websocket.ts`.
 *   - Mode-switch / workspace-collision UX.
 */
import type { HandshakeRejectReason, WorkspaceSnapshot } from '@openheaders/core/protocol';
import type { StateVector } from '@openheaders/core/sync';
import { EXTENSION_WORKSPACE_GLOBAL_SCOPE } from '@openheaders/core/sync';
import type { Org } from '@openheaders/core/types';
import { logger } from '@utils/logger';

import { type ConnectionState, createConnectionHandshake } from './connection-handshake';
import { type CatchupState, createScopeCatchupDriver } from './scope-catchup-driver';

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
  | 'timed-out' // local timer fired before a phase completed
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
   * settings, or null when none is configured. Sent on HELLO so
   * daemons bound non-loopback can validate the peer (U3.2).
   */
  readonly getAuthToken?: () => string | null;
  /** Folds the local log for a scope into a state vector. */
  readonly readStateVector: (scope: string) => Promise<StateVector>;
  /** Applies an inbound snapshot blob to local stores. */
  readonly applySnapshot: (snapshot: WorkspaceSnapshot) => Promise<void>;
  /**
   * Fires when the responder reports SYNCED for a scope. The initiator
   * passes the scope id + the peer's `stateVectorAfter` so the wiring
   * can prune + flush the pending-out queue (Phase C C16).
   */
  readonly onSynced: (scope: string, peerVector: StateVector) => Promise<void>;
  /** Optional — fired on a rejected WELCOME so the UI can surface the reason. */
  readonly onRejected?: (reason: HandshakeRejectReason, detail?: string) => void;
  /**
   * Optional — fired on an accepted WELCOME that carries the backend's
   * home `Org` (U5.2 "consume-first join"). The wiring records the Org
   * into this host's authorized set (`recordJoinedOrg`) so the
   * backend's workspaces sync down. Awaited before catch-up begins so
   * the catch-up frames aren't dropped by the receiver-side org filter.
   *
   * `backendActiveWorkspaceId` is the backend's currently-active
   * workspace (U5.9 "join → adopt") when the WELCOME carries it.
   */
  readonly onJoinedOrg?: (org: Org, backendActiveWorkspaceId?: string) => Promise<void>;
  /**
   * Wall-clock budget for each handshake phase (HELLO→WELCOME, and
   * STATE_VECTOR→SYNCED). Defaults to {@link DEFAULT_HANDSHAKE_TIMEOUT_MS}.
   */
  readonly timeoutMs?: number;
  /** Test seam — swap setTimeout / clearTimeout for fake timers. */
  readonly setTimer?: (fn: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

export interface SyncHandshakeInitiator {
  /** Current composed FSM phase — read by the status pill / diagnostics. */
  state(): InitiatorState;
  /** Most-recent rejection reason; null unless `state() === 'rejected'`. */
  rejectReason(): HandshakeRejectReason | null;
  /** Detail message for a `failed` terminal state (e.g. catch-up apply error). */
  failureDetail(): string | null;
  /** True iff `frame` is a handshake-flow type the initiator handles. */
  handles(frame: unknown): boolean;
  /** Process one inbound handshake frame. No-op for non-handshake frames. */
  handle(frame: unknown): Promise<void>;
  /** Send HELLO. Idempotent within one WS lifetime. */
  start(): Promise<void>;
  /** Reset to `idle` — called by the WS layer on socket close so the next open re-runs the handshake. */
  reset(): void;
  /**
   * Register an observer that fires on every composed-state transition.
   * Returns an unsubscribe function. Subscribers MUST NOT throw —
   * exceptions are caught + logged so a misbehaving subscriber can't
   * wedge the FSM.
   */
  subscribe(cb: (state: InitiatorState) => void): () => void;
}

/**
 * Compose the two sub-FSM states into the single phase the status pill
 * renders. The connection phase leads until it reaches `connected`,
 * after which the catch-up phase takes over.
 */
function composeState(connection: ConnectionState, catchup: CatchupState): InitiatorState {
  switch (connection) {
    case 'idle':
      return 'idle';
    case 'hello-sent':
      return 'hello-sent';
    case 'rejected':
      return 'rejected';
    case 'timed-out':
      return 'timed-out';
    case 'aborted':
      return 'aborted';
    case 'connected':
      break;
  }
  switch (catchup) {
    case 'idle':
    case 'vector-sent':
      return 'welcomed';
    case 'catching-up':
      return 'catching-up';
    case 'synced':
      return 'synced';
    case 'failed':
      return 'failed';
    case 'timed-out':
      return 'timed-out';
  }
}

export function createSyncHandshakeInitiator(deps: SyncHandshakeInitiatorDeps): SyncHandshakeInitiator {
  const subscribers = new Set<(state: InitiatorState) => void>();
  let lastEmitted: InitiatorState = 'idle';

  const catchup = createScopeCatchupDriver({
    send: deps.send,
    readStateVector: deps.readStateVector,
    applySnapshot: deps.applySnapshot,
    onSynced: deps.onSynced,
    timeoutMs: deps.timeoutMs,
    setTimer: deps.setTimer,
    clearTimer: deps.clearTimer,
  });

  const connection = createConnectionHandshake({
    send: deps.send,
    getActiveWorkspaceId: deps.getActiveWorkspaceId,
    getExtensionNodeId: deps.getExtensionNodeId,
    getExtensionAgent: deps.getExtensionAgent,
    getAuthToken: deps.getAuthToken,
    onJoinedOrg: deps.onJoinedOrg,
    onRejected: deps.onRejected,
    // U6.3 — the socket is open + authenticated: catch up the
    // `__global__` workspace-list scope so the backend's workspaces
    // become visible. The per-consumed-workspace fan-out (U6.4)
    // sequences further scopes after this one's SYNCED.
    onConnected: () => catchup.start(EXTENSION_WORKSPACE_GLOBAL_SCOPE),
    timeoutMs: deps.timeoutMs,
    setTimer: deps.setTimer,
    clearTimer: deps.clearTimer,
  });

  function emitIfChanged(): void {
    const next = composeState(connection.state(), catchup.state());
    if (next === lastEmitted) return;
    lastEmitted = next;
    for (const cb of [...subscribers]) {
      try {
        cb(next);
      } catch (err) {
        logger.warn(SCOPE, 'subscriber threw', err);
      }
    }
  }

  connection.subscribe(emitIfChanged);
  catchup.subscribe(emitIfChanged);

  function handles(frame: unknown): boolean {
    return connection.handles(frame) || catchup.handles(frame);
  }

  async function handle(frame: unknown): Promise<void> {
    if (connection.handles(frame)) {
      await connection.handle(frame);
      return;
    }
    if (catchup.handles(frame)) {
      await catchup.handle(frame);
    }
  }

  return {
    state: () => composeState(connection.state(), catchup.state()),
    rejectReason: () => connection.rejectReason(),
    failureDetail: () => catchup.failureDetail(),
    handles,
    handle,
    start: () => connection.start(),
    reset: () => {
      connection.reset();
      catchup.reset();
    },
    subscribe: (cb) => {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
  };
}
