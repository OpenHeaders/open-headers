/**
 * Host-neutral handshake dispatcher.
 *
 * Owns the receive-side semantics of the four handshake messages
 * (HELLO / WELCOME / STATE_VECTOR / SYNCED) for the *responding* peer
 * — typically the desktop main process or the future LAN/WAN daemon.
 * The *initiating* peer (the extension SW today) lives in the app
 * package and drives its own state machine via the wire types in
 * `@openheaders/core/protocol`.
 *
 * Why this module is separate from {@link dispatchSyncRpc}:
 *
 *   - **Streaming output.** STATE_VECTOR's response is a stream of
 *     mutation frames terminated by SYNCED, not a single `:response`
 *     envelope. The sync-rpc dispatcher's `{ kind: 'sync' | 'async',
 *     response }` shape doesn't model that. Forcing it would either
 *     leak streaming into every other RPC's contract or hide the
 *     stream behind an opaque promise.
 *   - **Per-connection lifecycle.** HELLO produces a long-lived
 *     {@link PeerConnection}; SYNCED transitions that connection's
 *     phase. sync-rpc handlers are stateless per-message.
 *
 * The dispatcher is split into two top-level functions so the host's
 * message loop can drive the lifecycle in the natural order:
 *
 *   1. {@link evaluateHello} — pure, synchronous; returns either an
 *      accept directive (the host then builds the PeerConnection) or
 *      a reject directive (the host sends WELCOME and closes).
 *   2. {@link handleStateVector} — async; given the already-built
 *      PeerConnection, runs the responder and streams via
 *      `peerConn.reply`. Returns the post-stream telemetry.
 */
import {
  PROTOCOL_VERSION,
  HANDSHAKE_REJECT_REASONS,
  HANDSHAKE_ROLES,
  SYNC_HELLO_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  SYNC_SYNCED_TYPE,
  SYNC_WELCOME_TYPE,
  SyncHelloMessageSchema,
  SyncStateVectorMessageSchema,
  isCompatibleProtocol,
  type HandshakeRole,
  type SyncHelloMessage,
  type SyncStateVectorMessage,
  type SyncWelcomeMessage,
} from '@openheaders/core/protocol';
import {
  emitAuditEntry,
  getIdentitySnapshot,
  hasCapability,
} from '@openheaders/core/identity';
import { logger } from '@openheaders/core/utils';
import * as v from 'valibot';

import type { PeerConnection } from '../host-runtime/peer-connection';
import {
  respondToStateVector,
  type RespondToStateVectorOptions,
  type RespondToStateVectorResult,
} from '../sync/handshake-responder';

const SCOPE = 'HandshakeDispatch';

/**
 * Identity the local host announces in WELCOME. Distinct from the
 * peer's HELLO identity carried on the {@link PeerConnection}.
 */
export interface LocalHandshakeIdentity {
  readonly role: HandshakeRole;
  readonly nodeId: string;
  readonly agent: string;
}

export type EvaluateHelloOutcome =
  | {
      readonly kind: 'accept';
      readonly hello: SyncHelloMessage;
      readonly welcome: SyncWelcomeMessage;
    }
  | {
      readonly kind: 'reject';
      readonly welcome: SyncWelcomeMessage;
      readonly reason: (typeof HANDSHAKE_REJECT_REASONS)[keyof typeof HANDSHAKE_REJECT_REASONS];
    };

/**
 * Per-handshake gating options. When `requireAuth` is true (set by the
 * host when its bind address is non-loopback), the dispatcher consults
 * the {@link hasCapability} resolver against the local identity
 * snapshot's `daemon.admin` capability. A deny becomes a WELCOME with
 * `reason: 'auth-required'` — the peer surfaces "this daemon requires
 * pairing" rather than a generic protocol-incompatible close.
 *
 * Loopback bind (`127.0.0.1`) stays trust-by-process per
 * `UNIFIED_ORACLE_MODEL.md` §4.2 — the host passes `requireAuth: false`
 * and the gate is a no-op. Phase U3.2 wires the toggle into the
 * Settings → Sync → Allow LAN peers surface; until then every host
 * binds loopback and runs ungated.
 */
export interface EvaluateHelloOptions {
  readonly requireAuth?: boolean;
}

/**
 * Inspect a parsed inbound frame against {@link SyncHelloMessageSchema}
 * and the local protocol compatibility band. Pure: no I/O, no socket
 * interaction. The host applies the outcome — sends the welcome frame,
 * builds the PeerConnection on accept, closes on reject.
 *
 * Throws if `frame.type` isn't `oh.sync.hello`. The host's message loop
 * is expected to route only matching frames here; any miss is a wiring
 * bug at the host level, not a runtime protocol error.
 */
export function evaluateHello(
  frame: Record<string, unknown>,
  identity: LocalHandshakeIdentity,
  options: EvaluateHelloOptions = {},
): EvaluateHelloOutcome {
  if (frame.type !== SYNC_HELLO_TYPE) {
    throw new Error(`evaluateHello: expected ${SYNC_HELLO_TYPE}, got ${String(frame.type)}`);
  }
  const parseResult = v.safeParse(SyncHelloMessageSchema, frame);
  if (!parseResult.success) {
    logger.warn(SCOPE, 'malformed HELLO; closing', parseResult.issues);
    const welcome: SyncWelcomeMessage = {
      type: SYNC_WELCOME_TYPE,
      accepted: false,
      reason: HANDSHAKE_REJECT_REASONS.PROTOCOL_TOO_OLD,
      protocolVersion: PROTOCOL_VERSION,
      detail: 'HELLO failed schema validation',
    };
    return { kind: 'reject', welcome, reason: HANDSHAKE_REJECT_REASONS.PROTOCOL_TOO_OLD };
  }
  const hello = parseResult.output;
  if (!isCompatibleProtocol(hello.protocolVersion)) {
    const reason =
      hello.protocolVersion > PROTOCOL_VERSION
        ? HANDSHAKE_REJECT_REASONS.PROTOCOL_TOO_NEW
        : HANDSHAKE_REJECT_REASONS.PROTOCOL_TOO_OLD;
    const welcome: SyncWelcomeMessage = {
      type: SYNC_WELCOME_TYPE,
      accepted: false,
      reason,
      protocolVersion: PROTOCOL_VERSION,
    };
    return { kind: 'reject', welcome, reason };
  }
  if (options.requireAuth) {
    const snapshot = getIdentitySnapshot();
    const decision = hasCapability(snapshot, 'daemon.admin', {});
    emitAuditEntry({
      actorUserId: snapshot?.user.id ?? 'unknown',
      capability: 'daemon.admin',
      decision,
    });
    if (!decision.allow) {
      logger.info(SCOPE, `HELLO rejected: auth required (${decision.reason ?? 'denied'})`);
      const welcome: SyncWelcomeMessage = {
        type: SYNC_WELCOME_TYPE,
        accepted: false,
        reason: HANDSHAKE_REJECT_REASONS.AUTH_REQUIRED,
        protocolVersion: PROTOCOL_VERSION,
        detail: decision.reason ?? 'auth required',
      };
      return { kind: 'reject', welcome, reason: HANDSHAKE_REJECT_REASONS.AUTH_REQUIRED };
    }
  }

  const welcome: SyncWelcomeMessage = {
    type: SYNC_WELCOME_TYPE,
    accepted: true,
    protocolVersion: PROTOCOL_VERSION,
    role: identity.role,
    nodeId: identity.nodeId,
    workspaceId: hello.workspaceId,
    agent: identity.agent,
  };
  return { kind: 'accept', hello, welcome };
}

export type HandleStateVectorOutcome =
  | {
      readonly kind: 'ok';
      readonly message: SyncStateVectorMessage;
      readonly result: RespondToStateVectorResult;
    }
  | {
      readonly kind: 'rejected';
      readonly reason: 'schema-invalid' | 'workspace-mismatch' | 'connection-closed';
      readonly detail?: string;
    };

export interface HandleStateVectorOptions {
  /** Forwarded to {@link respondToStateVector}; mirrors its options surface. */
  readonly responder?: RespondToStateVectorOptions;
  /** Test seam — swap out the responder for unit coverage of dispatch wiring. */
  readonly respond?: typeof respondToStateVector;
}

/**
 * Validate + dispatch a STATE_VECTOR frame for an already-connected
 * peer. Returns `rejected` on schema/workspace/connection failures so
 * the host can log + decide whether to close the socket; returns `ok`
 * with the responder's telemetry on a clean run (including
 * `syncedSent: false` if the peer closed mid-stream).
 */
export async function handleStateVector(
  frame: Record<string, unknown>,
  peerConn: PeerConnection,
  options: HandleStateVectorOptions = {},
): Promise<HandleStateVectorOutcome> {
  if (frame.type !== SYNC_STATE_VECTOR_TYPE) {
    throw new Error(`handleStateVector: expected ${SYNC_STATE_VECTOR_TYPE}, got ${String(frame.type)}`);
  }
  if (!peerConn.isOpen()) {
    return { kind: 'rejected', reason: 'connection-closed' };
  }
  const parseResult = v.safeParse(SyncStateVectorMessageSchema, frame);
  if (!parseResult.success) {
    logger.warn(SCOPE, `malformed STATE_VECTOR from peer ${peerConn.peerId}`, parseResult.issues);
    return { kind: 'rejected', reason: 'schema-invalid', detail: 'state-vector schema validation failed' };
  }
  const message = parseResult.output;
  if (message.workspaceId !== peerConn.workspaceId) {
    logger.warn(
      SCOPE,
      `STATE_VECTOR workspaceId ${message.workspaceId} doesn't match peer's HELLO workspace ${peerConn.workspaceId}; rejecting`,
    );
    return {
      kind: 'rejected',
      reason: 'workspace-mismatch',
      detail: `connection bound to ${peerConn.workspaceId}, got ${message.workspaceId}`,
    };
  }
  const respond = options.respond ?? respondToStateVector;
  const result = await respond(message, { send: (f) => peerConn.reply(f) }, options.responder);
  return { kind: 'ok', message, result };
}

/** Self-document the set of handshake message types this dispatcher recognizes. */
export const HANDSHAKE_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  SYNC_HELLO_TYPE,
  SYNC_WELCOME_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  SYNC_SYNCED_TYPE,
]);

export { HANDSHAKE_ROLES };
