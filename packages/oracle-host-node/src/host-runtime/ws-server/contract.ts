// ── Public contract — options + server API + peer snapshots ────────

import type { LocalHandshakeIdentity } from '@openheaders/oracle/rpc';
import type { PairingHttpHandler } from '../pairing-http';

export interface OracleWsServerOptions {
  /** Bind address — `127.0.0.1` for local-only, `0.0.0.0` for LAN. */
  host?: string;
  /** TCP port; defaults to `WS_PORT` so all components agree. */
  port?: number;
  /**
   * Identity this server announces in WELCOME frames. The host
   * typically passes `{ role: 'desktop', nodeId, agent: '@openheaders/desktop@<ver>' }`.
   * Required — without it the server has no identity to advertise and
   * the state-vector handshake can't run.
   */
  handshakeIdentity: LocalHandshakeIdentity;
  /**
   * Optional sibling HTTP handler — invoked on every non-upgrade
   * request that hits the bound socket. The handler must return
   * `true` when it owns the response (sync or pending async); the
   * server emits a bare 400 fallback when it returns `false`. Used
   * by the pairing device-flow surface (U3.3) to expose `/pair/<code>`
   * without spinning a second port. See {@link createPairingHttpHandler}.
   */
  httpRequestHandler?: PairingHttpHandler;
  /**
   * Override the per-connection loopback classification. Defaults to
   * `isLoopbackRemote` over the socket's remote address. A real
   * bind always sees `127.0.0.1` for same-host clients, so this seam
   * lets fault-injection tests simulate an off-device (LAN/WAN) peer to
   * exercise the WS-B reach gate (plan §10). Production never sets it.
   */
  classifyLoopback?: (remoteAddress: string | undefined) => boolean;
  /**
   * Override the server-driven heartbeat sweep cadence (ms). Defaults to
   * `HEARTBEAT_INTERVAL_MS`; tests set a short interval to exercise
   * dead-peer eviction without a 30s wait. Production never sets it.
   */
  heartbeatIntervalMs?: number;
}

/**
 * Lightweight snapshot of a connected peer — what status reporters and
 * admin surfaces need to know without holding a reference to the
 * underlying `PeerConnection`.
 *
 * `isLoopback` classifies the socket's origin for reporting + reach
 * decisions (e.g. same-device secret sync). It no longer gates auth —
 * every peer authenticates regardless of origin — but admin surfaces
 * still distinguish a same-device peer from a LAN one.
 */
export interface PeerSummary {
  readonly peerId: string;
  readonly role: string;
  readonly agent: string;
  readonly workspaceId: string;
  readonly tokenId: string | null;
  readonly isLoopback: boolean;
}

export type PeerChangeKind = 'connect' | 'disconnect';

export interface PeerChangeEvent {
  readonly kind: PeerChangeKind;
  readonly peer: PeerSummary;
}

export type PeerChangeListener = (event: PeerChangeEvent) => void;

export interface OracleWsServer {
  /** Fan a typed broadcast to every connected peer past handshake. */
  broadcast(type: string, payload: unknown): void;
  /**
   * Fan a pre-shaped JSON-serializable frame to every connected peer
   * past handshake — used by senders whose wire shape is NOT a
   * `{ type, payload }` envelope (e.g. mutation-stream frames carry
   * `workspaceId` + `envelope` at the top level). The frame must
   * already include a top-level `type` field; this method does not
   * wrap or rename anything.
   *
   * `opts.loopbackOnly` restricts the fan-out to same-device (loopback)
   * peers — the WS-B reach gate for frames carrying a same-device-only
   * secret (vault mutations). Off-device (LAN/WAN) peers are skipped.
   * Defaults to all peers; the caller classifies the frame (it owns the
   * typed envelope) and this transport enforces per-socket reach.
   */
  broadcastFrame(frame: Record<string, unknown>, opts?: { loopbackOnly?: boolean }): void;
  /** Number of connected peers past handshake — used for status logs. */
  connectedCount(): number;
  /**
   * The set of `DaemonAuthToken` ids that map to a peer connected
   * right now. Derived live from the peer registry — no independent
   * bookkeeping. Every authenticated peer carries a tokenId now that
   * auth is mandatory; a null tokenId only arises on the `requireAuth`-
   * off test seam and is excluded. Feeds the admin "Known devices"
   * surface (U3.4).
   */
  connectedTokenIds(): ReadonlySet<string>;
  /**
   * Force-disconnect every connected peer authenticated with the given
   * `DaemonAuthToken` id. Returns the number of sockets closed. Called
   * when a token is revoked so the kill-switch takes effect on the *live*
   * connection — not just on the peer's next HELLO. Without this a revoked
   * peer keeps receiving broadcasts + issuing RPCs until it voluntarily
   * disconnects (which a malicious peer never does). The close fires each
   * socket's `'close'` handler, reusing the same registry cleanup +
   * `disconnect` emission as any other drop; the peer's reconnect attempt
   * then re-validates against the now-revoked ledger and gets
   * `auth-required` (→ re-pair UX).
   */
  closePeersByTokenId(tokenId: string): number;
  /**
   * Snapshot of every connected peer past handshake. Used by status
   * reporters that bootstrap from the current state before subscribing.
   */
  listConnectedPeers(): readonly PeerSummary[];
  /**
   * Subscribe to peer connect/disconnect events. Fired AFTER the peer
   * registry update so a `listConnectedPeers()` call inside the listener
   * reflects the post-event state. Returns an unsubscribe function.
   */
  subscribePeerChange(listener: PeerChangeListener): () => void;
  /** Stop accepting connections and close all open ones. Idempotent. */
  close(): Promise<void>;
}
