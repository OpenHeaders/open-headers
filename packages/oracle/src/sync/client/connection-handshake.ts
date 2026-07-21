/**
 * Connection handshake — the HELLO/WELCOME exchange that opens a sync
 * socket. Runs exactly once per WS lifetime.
 *
 * Drives the FSM
 *
 *   `idle → hello-sent → connected`
 *
 * (or one of the terminal failures `rejected` / `timed-out` /
 * `aborted`). It owns:
 *
 *   - The HELLO frame — protocol version, role, the SW's nodeId, the
 *     active workspace the {@link PeerConnection} binds to, and the
 *     daemon auth token (U3.2).
 *   - The WELCOME frame — accept folds the backend's home `Org` into
 *     this host's authorized set via {@link ConnectionHandshakeDeps.onJoinedOrg}
 *     ("consume-first join", U5.2); reject surfaces the reason.
 *   - The `onConnected` signal that tells the coordinator the socket is
 *     authenticated and per-scope catch-up may begin.
 *
 * What it does NOT own: STATE_VECTOR / SNAPSHOT / SYNCED — those are
 * per-scope catch-up, driven by {@link createScopeCatchupDriver} once
 * this handshake reaches `connected`.
 */
import {
  type BackendReach,
  type HandshakeRejectReason,
  type HandshakeRole,
  PROTOCOL_VERSION,
  SYNC_HELLO_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  SYNC_WELCOME_TYPE,
  type SyncHelloMessage,
  SyncWelcomeMessageSchema,
} from '@openheaders/core/protocol';
import type { Org } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import * as v from 'valibot';

const SCOPE = 'ConnectionHandshake';

export type ConnectionState =
  | 'idle'
  | 'hello-sent'
  | 'connected'
  // Terminal failures.
  | 'rejected' // peer rejected our HELLO; detail via rejectReason()
  | 'timed-out' // local timer fired before WELCOME arrived
  | 'aborted'; // no active workspace, or the wire dropped mid-send

/** Default budget between HELLO and WELCOME. */
export const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;

export interface ConnectionHandshakeDeps {
  /** Write one frame to the backend. Returns false if the wire is gone. */
  readonly send: (frame: object) => boolean;
  /** The role this client announces in HELLO (extension, web, cli, …). */
  readonly role: HandshakeRole;
  /** Active workspace id; null when no workspace is selected. */
  readonly getActiveWorkspaceId: () => string | null;
  /** This host's HLC writer identity for `workspaceId`. */
  readonly getNodeId: (workspaceId: string) => string;
  /** Diagnostic agent string (e.g. `'@openheaders/extension@5.0.0'`). */
  readonly getAgent: () => string;
  /**
   * Stable per-install identity for HELLO's `installId`, or null when
   * the host has none hydrated. Unlike `getNodeId` this must not vary
   * with the active workspace — it is what lets the server re-bind
   * peer-scoped state across reconnects.
   */
  readonly getInstallId?: () => string | null;
  /**
   * The long-lived daemon auth token from settings, or null. Sent on
   * HELLO so non-loopback daemons can validate the peer (U3.2).
   */
  readonly getAuthToken?: () => string | null;
  /**
   * Fired once WELCOME is accepted — the coordinator starts catch-up.
   * Awaited so STATE_VECTOR is on the wire before the handshake's
   * `connected` transition is observed as settled.
   */
  readonly onConnected: () => void | Promise<void>;
  /**
   * Fired on an accepted WELCOME carrying the backend's home `Org`
   * (U5.2). Awaited before `onConnected` so the receiver-side org
   * filter doesn't drop the catch-up frames that follow.
   * `backendActiveWorkspaceId` is the backend's active workspace when
   * the WELCOME carries it (U5.9 join → adopt).
   */
  readonly onJoinedOrg?: (org: Org, backendActiveWorkspaceId?: string) => Promise<void>;
  /**
   * Fired on an accepted WELCOME with the backend's advertised reach
   * tier — `null` when the WELCOME omits it. Org-independent (unlike
   * {@link onJoinedOrg}) so reach is surfaced even pre-bootstrap.
   */
  readonly onReach?: (reach: BackendReach | null) => void;
  /** Fired on a rejected WELCOME so the UI can surface the reason. */
  readonly onRejected?: (reason: HandshakeRejectReason, detail?: string) => void;
  /** Budget between HELLO and WELCOME. Defaults to {@link DEFAULT_CONNECTION_TIMEOUT_MS}. */
  readonly timeoutMs?: number;
  /** Test seam — swap setTimeout / clearTimeout for fake timers. */
  readonly setTimer?: (fn: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

export interface ConnectionHandshake {
  state(): ConnectionState;
  rejectReason(): HandshakeRejectReason | null;
  /** True iff `frame` is a connection-flow type this handshake handles. */
  handles(frame: unknown): boolean;
  /** Process one inbound frame. No-op for non-connection frames. */
  handle(frame: unknown): Promise<void>;
  /** Send HELLO. Idempotent within one WS lifetime. */
  start(): Promise<void>;
  /** Reset to `idle` — called by the WS layer on socket close. */
  reset(): void;
  subscribe(cb: (state: ConnectionState) => void): () => void;
}

const CONNECTION_INBOUND_TYPES: ReadonlySet<string> = new Set([
  SYNC_WELCOME_TYPE,
  // Server-only — owned here so it doesn't fall through to the mutation receiver.
  SYNC_HELLO_TYPE,
]);

const TERMINAL_STATES: ReadonlySet<ConnectionState> = new Set(['rejected', 'timed-out', 'aborted', 'connected']);

export function createConnectionHandshake(deps: ConnectionHandshakeDeps): ConnectionHandshake {
  let state: ConnectionState = 'idle';
  let rejectReason: HandshakeRejectReason | null = null;
  let timeoutHandle: unknown = null;

  const subscribers = new Set<(state: ConnectionState) => void>();
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const timeoutMs = deps.timeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS;

  function clearConnectionTimer(): void {
    if (timeoutHandle !== null) {
      clearTimer(timeoutHandle);
      timeoutHandle = null;
    }
  }

  function transition(next: ConnectionState): void {
    if (state === next) return;
    logger.debug(SCOPE, `${state} → ${next}`);
    state = next;
    if (TERMINAL_STATES.has(next)) clearConnectionTimer();
    for (const cb of [...subscribers]) {
      try {
        cb(next);
      } catch (err) {
        logger.warn(SCOPE, 'subscriber threw', err);
      }
    }
  }

  function startConnectionTimer(): void {
    clearConnectionTimer();
    timeoutHandle = setTimer(() => {
      timeoutHandle = null;
      if (state === 'hello-sent') {
        logger.warn(SCOPE, `WELCOME never arrived after ${timeoutMs}ms`);
        transition('timed-out');
      }
    }, timeoutMs);
  }

  async function start(): Promise<void> {
    if (state !== 'idle') return; // already mid-handshake or done
    rejectReason = null;
    const workspaceId = deps.getActiveWorkspaceId();
    if (!workspaceId) {
      logger.info(SCOPE, 'no active workspace — skipping handshake');
      transition('aborted');
      return;
    }
    const authToken = deps.getAuthToken?.() ?? null;
    const installId = deps.getInstallId?.() ?? null;
    const hello: SyncHelloMessage = {
      type: SYNC_HELLO_TYPE,
      protocolVersion: PROTOCOL_VERSION,
      role: deps.role,
      nodeId: deps.getNodeId(workspaceId),
      workspaceId,
      agent: deps.getAgent(),
      ...(installId ? { installId } : {}),
      ...(authToken ? { authToken } : {}),
    };
    if (!deps.send(hello)) {
      logger.warn(SCOPE, 'HELLO send failed — wire gone');
      transition('aborted');
      return;
    }
    transition('hello-sent');
    startConnectionTimer();
  }

  function handles(frame: unknown): boolean {
    if (!frame || typeof frame !== 'object') return false;
    const t = (frame as { type?: unknown }).type;
    return typeof t === 'string' && CONNECTION_INBOUND_TYPES.has(t);
  }

  async function handle(frame: unknown): Promise<void> {
    if (!frame || typeof frame !== 'object') return;
    if (TERMINAL_STATES.has(state)) return;
    const t = (frame as { type?: unknown }).type;
    if (t === SYNC_WELCOME_TYPE) {
      await handleWelcome(frame);
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
    if (!parsed.output.accepted) {
      rejectReason = parsed.output.reason;
      transition('rejected');
      logger.warn(SCOPE, `handshake rejected: ${parsed.output.reason} ${parsed.output.detail ?? ''}`);
      deps.onRejected?.(parsed.output.reason, parsed.output.detail);
      return;
    }
    // WELCOME delivered — the HELLO→WELCOME wire phase is complete.
    // Clear the timer before the post-accept work (the onJoinedOrg
    // snapshot refresh, the onConnected catch-up kick) so a slow refresh
    // can't trip a spurious `timed-out` that the trailing `connected`
    // transition then silently has to override.
    clearConnectionTimer();
    // U5.2 — fold the backend's home Org into this host's authorized
    // set before any catch-up frame arrives. A throw here is logged but
    // never fails the handshake — the org filter degrades to "drop
    // until the next reconnect re-sends WELCOME," not a desync.
    const { org, activeWorkspaceId, reach } = parsed.output;
    deps.onReach?.(reach ?? null);
    if (org && deps.onJoinedOrg) {
      try {
        await deps.onJoinedOrg(org, activeWorkspaceId);
      } catch (err) {
        logger.warn(SCOPE, 'onJoinedOrg threw — backend Org not recorded', err);
      }
    }
    transition('connected');
    await deps.onConnected();
  }

  function reset(): void {
    clearConnectionTimer();
    state = 'idle';
    rejectReason = null;
    for (const cb of [...subscribers]) {
      try {
        cb(state);
      } catch (err) {
        logger.warn(SCOPE, 'subscriber threw on reset', err);
      }
    }
  }

  function subscribe(cb: (state: ConnectionState) => void): () => void {
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  }

  return {
    state: () => state,
    rejectReason: () => rejectReason,
    handles,
    handle,
    start,
    reset,
    subscribe,
  };
}
