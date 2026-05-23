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
  emitAuditEntry,
  getIdentitySnapshot,
  type ValidateDaemonAuthTokenResult,
  validateDaemonAuthToken,
} from '@openheaders/core/identity';
import {
  type BackendReach,
  HANDSHAKE_REJECT_REASONS,
  HANDSHAKE_ROLES,
  type HandshakeRole,
  isCompatibleProtocol,
  PROTOCOL_VERSION,
  SYNC_HELLO_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  SYNC_SYNCED_TYPE,
  SYNC_WELCOME_TYPE,
  type SyncHelloMessage,
  SyncHelloMessageSchema,
  type SyncStateVectorMessage,
  SyncStateVectorMessageSchema,
  type SyncWelcomeMessage,
} from '@openheaders/core/protocol';
import { logger } from '@openheaders/core/utils';
import * as v from 'valibot';

import type { PeerConnection } from '../host-runtime/peer-connection';
import { peekActiveWorkspaceId } from '../sync';
import {
  type RespondToStateVectorOptions,
  type RespondToStateVectorResult,
  respondToStateVector,
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
      /**
       * The `DaemonAuthToken` id the peer authenticated with, or null
       * when the bind is loopback (`requireAuth` off — trust-by-process).
       * The host stamps this onto the {@link PeerConnection} so the
       * admin "Known devices" surface can join live peers to the ledger.
       */
      readonly tokenId: string | null;
    }
  | {
      readonly kind: 'reject';
      readonly welcome: SyncWelcomeMessage;
      readonly reason: (typeof HANDSHAKE_REJECT_REASONS)[keyof typeof HANDSHAKE_REJECT_REASONS];
    };

/**
 * Per-handshake gating options. When `requireAuth` is true (set by the
 * host when its bind address is non-loopback per
 * `UNIFIED_ORACLE_MODEL.md` §4.2), the dispatcher hashes
 * `hello.authToken` and constant-time-compares against the persisted
 * daemon auth-token ledger. A miss becomes a WELCOME with
 * `reason: 'auth-required'` — the peer surfaces "this daemon requires
 * pairing" rather than a generic protocol-incompatible close.
 *
 * Loopback bind (`127.0.0.1`) stays trust-by-process — the host passes
 * `requireAuth: false` and the gate is a no-op.
 *
 * `validate` is an optional test seam — swap in a stubbed validator to
 * exercise dispatch wiring without round-tripping `hostStorage`.
 */
export interface EvaluateHelloOptions {
  readonly requireAuth?: boolean;
  readonly validate?: (token: string | undefined) => Promise<ValidateDaemonAuthTokenResult>;
  /**
   * This backend's reach tier, derived by the host from its own listen
   * binding (loopback vs lan) or deployment (wan). Stamped onto the
   * WELCOME so the joining peer can render accurate reach guidance.
   * Omitted → the WELCOME carries no `reach` and the joiner treats it
   * as unknown.
   */
  readonly reach?: BackendReach;
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
export async function evaluateHello(
  frame: Record<string, unknown>,
  identity: LocalHandshakeIdentity,
  options: EvaluateHelloOptions = {},
): Promise<EvaluateHelloOutcome> {
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
  let tokenId: string | null = null;
  if (options.requireAuth) {
    const snapshot = getIdentitySnapshot();
    const validate = options.validate ?? validateDaemonAuthToken;
    const result = await validate(hello.authToken);
    // Audit the gate decision. `daemon.admin` is the capability the
    // local resolver maps the gate to — successful peer auth means the
    // peer is permitted to operate against this daemon; a miss is a
    // denial recorded against the local synthetic actor for ledger
    // continuity. The token id (if any) goes on the audit context
    // rather than the actor — the peer's identity isn't resolved until
    // after handshake.
    emitAuditEntry({
      actorUserId: snapshot?.user.id ?? 'unknown',
      capability: 'daemon.admin',
      decision: result.ok ? { allow: true } : { allow: false, reason: 'auth-required' },
    });
    if (!result.ok) {
      logger.info(SCOPE, `HELLO rejected: auth required (${result.reason})`);
      const welcome: SyncWelcomeMessage = {
        type: SYNC_WELCOME_TYPE,
        accepted: false,
        reason: HANDSHAKE_REJECT_REASONS.AUTH_REQUIRED,
        protocolVersion: PROTOCOL_VERSION,
        // Never echo the presented secret. `reason` is a coarse enum
        // safe for the client to render ("paired token revoked",
        // "unknown token", "no token presented").
        detail: result.reason,
      };
      return { kind: 'reject', welcome, reason: HANDSHAKE_REJECT_REASONS.AUTH_REQUIRED };
    }
    tokenId = result.tokenId;
  }

  // U5.2 — carry this backend's home `Org` so the joining peer folds it
  // into its authorized Org set ("consume-first join", §6.2). Absent
  // when no identity snapshot is hydrated yet (pre-bootstrap); the
  // joiner simply skips the fold. The home-org is the right grain:
  // trust-zone-scoped workspaces bind to it, so authorizing it lets the
  // backend's synced workspaces — but not its local-org-pinned ones —
  // reach the joiner.
  const localSnapshot = getIdentitySnapshot();
  const homeOrg = localSnapshot?.orgs.get(localSnapshot.user.homeOrgId);
  // U5.9 — carry this backend's active workspace so a consume-only join
  // can adopt it (switch the joiner's active workspace once it has
  // synced down). Absent when no workspace is active on this host.
  const backendActiveWorkspaceId = peekActiveWorkspaceId();
  const welcome: SyncWelcomeMessage = {
    type: SYNC_WELCOME_TYPE,
    accepted: true,
    protocolVersion: PROTOCOL_VERSION,
    role: identity.role,
    nodeId: identity.nodeId,
    workspaceId: hello.workspaceId,
    agent: identity.agent,
    ...(homeOrg ? { org: homeOrg } : {}),
    ...(backendActiveWorkspaceId ? { activeWorkspaceId: backendActiveWorkspaceId } : {}),
    ...(options.reach ? { reach: options.reach } : {}),
  };
  return { kind: 'accept', hello, welcome, tokenId };
}

export type HandleStateVectorOutcome =
  | {
      readonly kind: 'ok';
      readonly message: SyncStateVectorMessage;
      readonly result: RespondToStateVectorResult;
    }
  | {
      readonly kind: 'rejected';
      readonly reason: 'schema-invalid' | 'connection-closed';
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
  // The PeerConnection is bound to the workspace named in HELLO, but a
  // single socket carries catch-up for many scopes (U6.3): `__global__`
  // then each consumed workspace. Each STATE_VECTOR names its own
  // scope; the responder reads + streams that scope's log directly, so
  // the guard is per-frame (the scope on the message) — never the
  // connection's HELLO workspace.
  const message = parseResult.output;
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
