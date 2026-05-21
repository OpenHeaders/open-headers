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
   * U6.4 — enumerates the workspace ids whose `orgId` is a *consumed*
   * Org. Read once after the `__global__` scope's SYNCED (the backend's
   * workspace list is local by then); the coordinator fans a
   * per-workspace catch-up out for each over the single socket.
   *
   * Order is honoured: the caller should place the adopted active
   * workspace first so a mid-fan-out SW death still leaves the user on
   * a synced workspace (Session 19 SW-lifetime finding). Absent → no
   * fan-out (only the `__global__` scope syncs).
   */
  readonly listConsumedWorkspaceIds?: () => readonly string[];
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
  /**
   * U6.4 — re-enumerate consumed workspaces and fan out any that the
   * post-`__global__` enumeration missed. The `__global__` workspace
   * list lands as MUTATION frames applied asynchronously, so the
   * enumeration at `__global__` SYNCED can race ahead of the store;
   * the WS host calls this on every workspace-store change so a
   * late-arriving consumed workspace still gets its data catch-up
   * without waiting for a full reconnect. No-op until `__global__`
   * has synced on the current socket.
   */
  refreshFanOut(): void;
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

  // U6.4 — consumed-workspace scopes still awaiting a catch-up. Filled
  // when the `__global__` scope reaches SYNCED; drained one scope at a
  // time, each `start` chained off the prior scope's terminal state.
  let fanOutQueue: string[] = [];
  // Every consumed scope already queued / caught up on this socket —
  // so `refreshFanOut` only ever appends the genuinely-new ones.
  const fannedOutScopes = new Set<string>();
  // True once the `__global__` scope has SYNCED on the current socket;
  // gates `refreshFanOut` (there is no workspace list to extend before).
  let globalScopeSynced = false;

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

  /**
   * U6.5 — start the next consumed-workspace catch-up, if any. One
   * socket, one scope at a time: the driver serializes (a fresh
   * `start` is ignored while a catch-up is running), and chaining each
   * call off the prior scope's terminal state keeps the fan-out
   * sequential.
   */
  function startNextFanOutScope(): void {
    const next = fanOutQueue.shift();
    if (next === undefined) return;
    logger.debug(SCOPE, `fan-out → catching up consumed workspace scope ${next}`);
    void catchup.start(next);
  }

  /** Append consumed scopes not already queued / caught up this socket. */
  function enqueueFanOutScopes(scopes: readonly string[]): number {
    let added = 0;
    for (const id of scopes) {
      if (fannedOutScopes.has(id)) continue;
      fannedOutScopes.add(id);
      fanOutQueue.push(id);
      added++;
    }
    return added;
  }

  /** True when the catch-up driver can accept a fresh `start(scope)`. */
  function catchupIsResumable(): boolean {
    const s = catchup.state();
    return s !== 'vector-sent' && s !== 'catching-up';
  }

  function refreshFanOut(): void {
    if (!globalScopeSynced || connection.state() !== 'connected') return;
    const added = enqueueFanOutScopes(deps.listConsumedWorkspaceIds?.() ?? []);
    if (added === 0) return;
    logger.info(SCOPE, `fan-out extended by ${added} late consumed workspace(s)`);
    // A running catch-up's SYNCED already drains the (now-larger)
    // queue; only kick the driver when it is idle / terminal.
    if (catchupIsResumable()) startNextFanOutScope();
  }

  // U6.4 — drive the multi-scope fan-out off each catch-up's terminal
  // state. After the `__global__` scope SYNCED the backend's workspace
  // list is (being) applied locally: enumerate the consumed-Org
  // workspaces and queue a per-workspace catch-up for each. A consumed
  // workspace that fails or times out must not strand the rest of the
  // queue — advance anyway.
  catchup.subscribe((catchupState) => {
    if (catchupState === 'synced') {
      if (catchup.currentScope() === EXTENSION_WORKSPACE_GLOBAL_SCOPE) {
        fanOutQueue = [];
        fannedOutScopes.clear();
        globalScopeSynced = true;
        const added = enqueueFanOutScopes(deps.listConsumedWorkspaceIds?.() ?? []);
        logger.info(SCOPE, `__global__ synced — fanning out ${added} consumed workspace(s)`);
      }
      startNextFanOutScope();
      return;
    }
    if ((catchupState === 'failed' || catchupState === 'timed-out') && fanOutQueue.length > 0) {
      logger.warn(SCOPE, `scope ${catchup.currentScope()} catch-up ${catchupState}; continuing fan-out`);
      startNextFanOutScope();
    }
  });

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
    start: () => {
      // A genuine fresh socket re-runs the whole handshake — drop any
      // fan-out state from a prior socket. Guarded on `idle` so a
      // redundant `start()` mid-handshake can't wipe an active fan-out.
      if (connection.state() === 'idle') {
        fanOutQueue = [];
        fannedOutScopes.clear();
        globalScopeSynced = false;
      }
      return connection.start();
    },
    refreshFanOut,
    reset: () => {
      fanOutQueue = [];
      fannedOutScopes.clear();
      globalScopeSynced = false;
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
