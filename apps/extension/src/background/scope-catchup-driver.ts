/**
 * Per-scope catch-up driver — the STATE_VECTOR → SNAPSHOT/MUTATION →
 * SYNCED exchange that brings one sync scope up to date.
 *
 * Runs after the {@link createConnectionHandshake} reaches `connected`.
 * Repeatable: `start(scope)` can be called once per scope — first the
 * `__global__` workspace-list scope (so the backend's workspaces
 * become visible), then each consumed workspace (U6.4 fan-out). One
 * driver instance handles one scope at a time; the coordinator
 * sequences calls over the single socket.
 *
 * Drives the FSM
 *
 *   `idle → vector-sent → catching-up → synced`
 *
 * (or terminal `failed` / `timed-out`).
 *
 * Frame routing. SNAPSHOT and SYNCED frames carry their own
 * `workspaceId`; the driver drops any whose scope doesn't match the
 * scope it is currently catching up — the responder always echoes the
 * STATE_VECTOR's scope, so a mismatch means a stale frame from a prior
 * scope's exchange. MUTATION frames are NOT handled here — they flow to
 * the mutation receiver unchanged; HLC dedup absorbs any overlap with
 * the snapshot.
 */
import {
  SYNC_SNAPSHOT_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  SYNC_SYNCED_TYPE,
  SyncSnapshotMessageSchema,
  type SyncStateVectorMessage,
  SyncSyncedMessageSchema,
  type WorkspaceSnapshot,
} from '@openheaders/core/protocol';
import type { StateVector } from '@openheaders/core/sync';
import { logger } from '@utils/logger';
import * as v from 'valibot';

const SCOPE = 'ScopeCatchupDriver';

export type CatchupState =
  | 'idle'
  | 'vector-sent'
  | 'catching-up'
  | 'synced'
  // Terminal failures.
  | 'failed' // catch-up application error; detail via failureDetail()
  | 'timed-out'; // local timer fired before SYNCED arrived

/** Default budget between STATE_VECTOR and SYNCED. */
export const DEFAULT_CATCHUP_TIMEOUT_MS = 10_000;

export interface ScopeCatchupDeps {
  /** Write one frame to the backend. Returns false if the wire is gone. */
  readonly send: (frame: object) => boolean;
  /** Folds the local log for `scope` into a state vector. */
  readonly readStateVector: (scope: string) => Promise<StateVector>;
  /** Applies an inbound snapshot blob to local stores. */
  readonly applySnapshot: (snapshot: WorkspaceSnapshot) => Promise<void>;
  /**
   * Fired when the responder reports SYNCED for `scope`. The driver
   * passes the peer's post-catch-up vector so the wiring can prune +
   * flush the pending-out queue (Phase C C16).
   */
  readonly onSynced: (scope: string, peerVector: StateVector) => Promise<void>;
  /** Budget between STATE_VECTOR and SYNCED. Defaults to {@link DEFAULT_CATCHUP_TIMEOUT_MS}. */
  readonly timeoutMs?: number;
  /** Test seam — swap setTimeout / clearTimeout for fake timers. */
  readonly setTimer?: (fn: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

export interface ScopeCatchupDriver {
  state(): CatchupState;
  failureDetail(): string | null;
  /** The scope currently being caught up, or null when idle. */
  currentScope(): string | null;
  /** True iff `frame` is a catch-up-flow type this driver handles. */
  handles(frame: unknown): boolean;
  /** Process one inbound frame. No-op for non-catch-up frames. */
  handle(frame: unknown): Promise<void>;
  /** Send STATE_VECTOR for `scope` and begin its catch-up. */
  start(scope: string): Promise<void>;
  /** Reset to `idle`. */
  reset(): void;
  subscribe(cb: (state: CatchupState) => void): () => void;
}

const CATCHUP_INBOUND_TYPES: ReadonlySet<string> = new Set([
  SYNC_SNAPSHOT_TYPE,
  SYNC_SYNCED_TYPE,
  // Server-only — owned here so it doesn't fall through to the mutation receiver.
  SYNC_STATE_VECTOR_TYPE,
]);

/** A new `start(scope)` is allowed only from these (non-running) states. */
const RESUMABLE_STATES: ReadonlySet<CatchupState> = new Set(['idle', 'synced', 'failed', 'timed-out']);

const TERMINAL_STATES: ReadonlySet<CatchupState> = new Set(['synced', 'failed', 'timed-out']);

export function createScopeCatchupDriver(deps: ScopeCatchupDeps): ScopeCatchupDriver {
  let state: CatchupState = 'idle';
  let failureDetail: string | null = null;
  let scope: string | null = null;
  let timeoutHandle: unknown = null;

  const subscribers = new Set<(state: CatchupState) => void>();
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const timeoutMs = deps.timeoutMs ?? DEFAULT_CATCHUP_TIMEOUT_MS;

  function clearCatchupTimer(): void {
    if (timeoutHandle !== null) {
      clearTimer(timeoutHandle);
      timeoutHandle = null;
    }
  }

  function transition(next: CatchupState): void {
    if (state === next) return;
    logger.debug(SCOPE, `[${scope}] ${state} → ${next}`);
    state = next;
    if (TERMINAL_STATES.has(next)) clearCatchupTimer();
    for (const cb of [...subscribers]) {
      try {
        cb(next);
      } catch (err) {
        logger.warn(SCOPE, 'subscriber threw', err);
      }
    }
  }

  function startCatchupTimer(): void {
    clearCatchupTimer();
    timeoutHandle = setTimer(() => {
      timeoutHandle = null;
      if (state === 'vector-sent' || state === 'catching-up') {
        logger.warn(SCOPE, `[${scope}] SYNCED never arrived after ${timeoutMs}ms in ${state}`);
        transition('timed-out');
      }
    }, timeoutMs);
  }

  async function start(nextScope: string): Promise<void> {
    if (!RESUMABLE_STATES.has(state)) {
      logger.info(SCOPE, `start(${nextScope}) ignored — ${scope} catch-up still in ${state}`);
      return;
    }
    failureDetail = null;
    scope = nextScope;
    // Force a fresh observable transition even when resuming from a
    // terminal state — subscribers see the new scope's run begin.
    state = 'idle';
    let perNodeMaxHlc: StateVector;
    try {
      perNodeMaxHlc = await deps.readStateVector(nextScope);
    } catch (err) {
      logger.warn(SCOPE, `[${nextScope}] readStateVector failed`, err);
      failureDetail = `state-vector read failed: ${(err as Error)?.message ?? String(err)}`;
      transition('failed');
      return;
    }
    const stateVector: SyncStateVectorMessage = {
      type: SYNC_STATE_VECTOR_TYPE,
      workspaceId: nextScope,
      perNodeMaxHlc,
    };
    if (!deps.send(stateVector)) {
      logger.warn(SCOPE, `[${nextScope}] STATE_VECTOR send failed — wire gone`);
      failureDetail = 'STATE_VECTOR send failed — wire gone';
      transition('failed');
      return;
    }
    transition('vector-sent');
    startCatchupTimer();
  }

  function handles(frame: unknown): boolean {
    if (!frame || typeof frame !== 'object') return false;
    const t = (frame as { type?: unknown }).type;
    return typeof t === 'string' && CATCHUP_INBOUND_TYPES.has(t);
  }

  async function handle(frame: unknown): Promise<void> {
    if (!frame || typeof frame !== 'object') return;
    if (TERMINAL_STATES.has(state) || state === 'idle') return;
    const t = (frame as { type?: unknown }).type;
    if (t === SYNC_SNAPSHOT_TYPE) {
      await handleSnapshot(frame);
      return;
    }
    if (t === SYNC_SYNCED_TYPE) {
      await handleSynced(frame);
      return;
    }
    if (t === SYNC_STATE_VECTOR_TYPE) {
      logger.warn(SCOPE, 'received server-only STATE_VECTOR; dropping');
    }
  }

  async function handleSnapshot(frame: object): Promise<void> {
    const parsed = v.safeParse(SyncSnapshotMessageSchema, frame);
    if (!parsed.success) {
      logger.warn(SCOPE, 'malformed SNAPSHOT; dropping', parsed.issues);
      return;
    }
    if (parsed.output.workspaceId !== scope) {
      logger.warn(SCOPE, `SNAPSHOT scope ${parsed.output.workspaceId} != ${scope}; dropping stale frame`);
      return;
    }
    if (state === 'vector-sent') transition('catching-up');
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
    if (parsed.output.workspaceId !== scope) {
      logger.warn(SCOPE, `SYNCED scope ${parsed.output.workspaceId} != ${scope}; dropping stale frame`);
      return;
    }
    try {
      await deps.onSynced(parsed.output.workspaceId, parsed.output.stateVectorAfter);
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
    clearCatchupTimer();
    state = 'idle';
    failureDetail = null;
    scope = null;
    for (const cb of [...subscribers]) {
      try {
        cb(state);
      } catch (err) {
        logger.warn(SCOPE, 'subscriber threw on reset', err);
      }
    }
  }

  function subscribe(cb: (state: CatchupState) => void): () => void {
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  }

  return {
    state: () => state,
    failureDetail: () => failureDetail,
    currentScope: () => scope,
    handles,
    handle,
    start,
    reset,
    subscribe,
  };
}
