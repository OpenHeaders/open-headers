/**
 * `PeerConnection` — the identity + reply seam for one in-flight peer.
 *
 * One value per accepted WS socket past HELLO. Carries everything the
 * sync engine (and, in Phase D, the audit / authorization layers) need
 * to know about who's on the other end, plus the closure-bound `reply`
 * that lets a request handler write back on the *same* socket the
 * request arrived on.
 *
 * The shape is deliberately small. Three layers compose on top:
 *
 * 1. **Now (Phase C):** the handshake dispatcher reads the connection's
 *    identity off HELLO and stamps it here. `claims` is null —
 *    localhost-to-localhost is trust-by-process per §11.4.
 * 2. **Phase D LAN/WAN solo:** the long-lived token gets validated at
 *    HELLO; `claims.userId` populates from the token's subject.
 * 3. **Phase D WAN multi-user:** OAuth claims travel here; per-RPC
 *    authorization checks read `claims.capabilities` against the
 *    workspace ACL. The audit log records `(peerId, claims.userId)`
 *    next to every accepted mutation.
 *
 * **Why per-connection reply instead of a peer registry**: the
 * STATE_VECTOR catch-up is a request/response interaction — the
 * reply naturally belongs to the inbound socket. Threading a peerId
 * through a server-wide registry would invent identity bookkeeping
 * for a unicast operation that already has a perfectly good handle
 * (the socket itself). When server-initiated push to a specific
 * logical user matters (admin force-disconnect, permission
 * revocation), a `PeerRegistry` layers on top — see the
 * complementary phase-D note in `docs/DATA_PLANE_TOPOLOGIES.md §8`.
 *
 * **Lifecycle.** Created by the host runtime (ws-server today, the
 * future daemon's transport tomorrow) after a successful HELLO/WELCOME
 * exchange. Disposed by the host on `close`; `isOpen()` flips to false
 * and further `reply` calls return `false` without throwing so
 * streaming responders detect mid-stream disconnects and stop.
 */

import type { HandshakeRole } from '@openheaders/core/protocol';

/**
 * Authorization context for the peer. Null in Phase C (trust-by-
 * process); populated in Phase D from the validated auth token /
 * OAuth claim set.
 *
 * Kept as a separate slot rather than inlined into {@link PeerConnection}
 * so the Phase-C code path doesn't have to construct empty placeholder
 * values, and so the Phase-D auth wiring lives behind a single seam.
 */
export interface PeerClaims {
  /** Authenticated user identity. */
  readonly userId: string;
  /** Per-device identity inside the user's account. */
  readonly deviceId: string;
  /**
   * Capability tokens granted by the auth layer. Per-workspace ACL
   * checks read this set; the shape stays opaque here because the
   * capability vocabulary is owned by the auth layer.
   */
  readonly capabilities: ReadonlySet<string>;
}

export interface PeerConnection {
  /** Stable for the connection's lifetime. Minted on accept; not persisted across reconnects. */
  readonly peerId: string;
  /** HLC writer identity the peer announced in HELLO. */
  readonly nodeId: string;
  /** Self-declared role (extension / desktop / daemon / cli) — diagnostic only in Phase C. */
  readonly role: HandshakeRole;
  /** Free-form agent string from HELLO; diagnostic only. */
  readonly agent: string;
  /** Workspace the connection is bound to (the one the peer announced in HELLO). */
  readonly workspaceId: string;
  /** Protocol version the peer announced; already known to be compatible by the time this is constructed. */
  readonly protocolVersion: number;
  /** Wall-clock time the connection finished HELLO/WELCOME. */
  readonly connectedAt: number;
  /** Phase-D auth context; null in Phase C. */
  readonly claims: PeerClaims | null;

  /** False once `close` has been called or the underlying transport reported a close. */
  isOpen(): boolean;

  /**
   * Write one JSON-serializable frame back over the peer's socket.
   * Returns false if the connection is closed or the transport
   * reported a write failure — streaming responders MUST check the
   * return and stop iterating on false to avoid pumping into a
   * dead socket.
   */
  reply(frame: object): boolean;

  /**
   * Close the underlying transport. Idempotent; subsequent calls
   * are no-ops. `code` / `reason` follow WebSocket conventions
   * (1000 = normal close, 4xxx = application-specific).
   */
  close(code?: number, reason?: string): void;
}

export interface PeerConnectionSpec {
  readonly peerId: string;
  readonly nodeId: string;
  readonly role: HandshakeRole;
  readonly agent: string;
  readonly workspaceId: string;
  readonly protocolVersion: number;
  readonly claims?: PeerClaims | null;
  /** Underlying transport write. Returning false signals a closed/errored socket. */
  readonly send: (frame: object) => boolean;
  /** Underlying transport close. */
  readonly close: (code?: number, reason?: string) => void;
  /** Test seam for connectedAt; defaults to `Date.now`. */
  readonly now?: () => number;
}

export function createPeerConnection(spec: PeerConnectionSpec): PeerConnection {
  let open = true;
  const connectedAt = (spec.now ?? Date.now)();
  return {
    peerId: spec.peerId,
    nodeId: spec.nodeId,
    role: spec.role,
    agent: spec.agent,
    workspaceId: spec.workspaceId,
    protocolVersion: spec.protocolVersion,
    connectedAt,
    claims: spec.claims ?? null,
    isOpen: () => open,
    reply: (frame) => {
      if (!open) return false;
      const sent = spec.send(frame);
      if (!sent) open = false;
      return sent;
    },
    close: (code, reason) => {
      if (!open) return;
      open = false;
      spec.close(code, reason);
    },
  };
}
