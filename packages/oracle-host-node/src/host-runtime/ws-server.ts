/**
 * WebSocket server for host-side oracle access — the "extension-as-client
 * of desktop / daemon" pipe (`docs/refactor-status.md` Desktop host #2
 * Stage 2 commit 9; `.notes/oracle-arc.md` Mode 2 / Mode 3).
 *
 * Lives in `@openheaders/oracle-host-node/host-runtime` rather than
 * apps/desktop so any Node host can reuse it — Electron main today, a headless Node
 * daemon tomorrow, the cloud daemon eventually. The Electron-specific
 * glue is just composition (where to listen + how to fan
 * `OracleHostHooks.broadcast*` to both renderers and connected WS
 * clients) and lives in `apps/desktop/src/main/`.
 *
 * Wire shape:
 *
 *   - **Handshake.** First message from each peer is `oh.sync.hello`
 *     carrying `{ protocolVersion, role, nodeId, workspaceId, agent }`.
 *     The server validates against the compatibility band and replies
 *     `oh.sync.welcome` (accept | reject). A successful HELLO produces
 *     a {@link PeerConnection} bound to this socket; rejected peers
 *     get a `PROTOCOL_INCOMPATIBLE_CLOSE_CODE` (4001) close so the
 *     client surfaces "update extension" instead of generic
 *     disconnect noise.
 *   - **State-vector catch-up.** After WELCOME, the peer sends
 *     `oh.sync.stateVector`; the server streams a SNAPSHOT (cold
 *     receiver) and/or a delta of `oh.sync.mutation` frames against
 *     the peer's vector, terminated by `oh.sync.synced`. See
 *     {@link handleStateVector} + {@link respondToStateVector}.
 *   - **Keep-alive.** The peer sends `{ type: 'ping', t: <ms> }` on
 *     `backend.pingIntervalMs`. The server replies with
 *     `{ type: 'pong', t: <ms> }` so half-dead sockets get cleaned up
 *     rather than accumulating until idle-timeout disconnects fire.
 *   - **Sync RPCs.** Anything else routes through {@link dispatchSyncRpc}
 *     (the same dispatcher the IPC handler uses). When the dispatcher
 *     recognizes the channel and returns a response, the server sends
 *     `{ type: '<rpc>:response', ...payload }` back over the same
 *     connection. Channels outside the 22 sync+awareness ones are
 *     silently ignored.
 *   - **Broadcasts.** {@link broadcast} / {@link broadcastFrame} fan
 *     an oracle event out to every connected peer past handshake. The
 *     host wires this into `OracleHostHooks.broadcastSyncEvent` /
 *     `broadcastAwareness` so renderers (over IPC) and remote peers
 *     (over WS) see the same stream.
 *
 * Reachability check: the extension does a `fetch(http://…)` with
 * `no-cors` before opening the WS. Any HTTP response satisfies it; we
 * let the `ws` package's default HTTP responder (HTTP 400 for non-
 * upgrade requests) cover that — no separate HTTP server needed.
 *
 * Bind address: defaults to `127.0.0.1` (localhost-only). LAN/tunneled
 * deployments override with `host: '0.0.0.0'`. Auth is mandatory on every
 * connection regardless of bind or remote address: loopback is reachable
 * cross-user on a shared box and TCP blocks OS peer-cred, so
 * trust-by-process isn't a sound floor. Every peer presents a paired
 * token at HELLO.
 */

import { randomUUID } from 'node:crypto';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { hostLogger as logger } from '@openheaders/core/logger';
import {
  BACKEND_REACH,
  type BackendReach,
  PROTOCOL_INCOMPATIBLE_CLOSE_CODE,
  SYNC_HELLO_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  WS_PORT,
} from '@openheaders/core/protocol';
import { getHostStorage, OH } from '@openheaders/core/storage';
import { createPeerConnection, type PeerConnection } from '@openheaders/oracle/host-runtime/peer-connection';
import {
  dispatchSyncRpc,
  evaluateHello,
  handleStateVector,
  type LocalHandshakeIdentity,
} from '@openheaders/oracle/rpc';
import { type RawData, WebSocket, WebSocketServer } from 'ws';
import type { PairingHttpHandler } from './pairing-http';

const SCOPE = 'OracleWsServer';
const HANDSHAKE_TIMEOUT_MS = 5_000;

/**
 * Server-driven liveness sweep cadence. Each tick terminates any peer
 * that didn't answer the previous protocol-level PING (or send any other
 * frame) since the last sweep, then re-pings the survivors. Without this
 * a peer that dies *without* a clean TCP close — laptop sleep, hard
 * crash, cable pull, Wi-Fi drop — lingers in the registry until the OS
 * TCP stack gives up (minutes), inflating `connectedCount()` and keeping
 * a corpse eligible for `broadcastFrame`. Independent of the client's
 * `backend.pingIntervalMs` (a different layer, client-owned, anti-proxy-
 * idle) so a client config can't weaken server-side dead-peer eviction.
 */
const HEARTBEAT_INTERVAL_MS = 30_000;

interface PingMessage {
  type: 'ping';
  t?: number;
}

interface RpcMessage {
  type: string;
  [key: string]: unknown;
}

function isPing(m: unknown): m is PingMessage {
  return Boolean(m && typeof m === 'object' && (m as { type?: unknown }).type === 'ping');
}

export interface OracleWsServerOptions {
  /** Bind address — `127.0.0.1` for local-only, `0.0.0.0` for LAN. */
  host?: string;
  /** TCP port; defaults to {@link WS_PORT} so all components agree. */
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
   * {@link isLoopbackRemote} over the socket's remote address. A real
   * bind always sees `127.0.0.1` for same-host clients, so this seam
   * lets fault-injection tests simulate an off-device (LAN/WAN) peer to
   * exercise the WS-B reach gate (plan §10). Production never sets it.
   */
  classifyLoopback?: (remoteAddress: string | undefined) => boolean;
  /**
   * Override the server-driven heartbeat sweep cadence (ms). Defaults to
   * {@link HEARTBEAT_INTERVAL_MS}; tests set a short interval to exercise
   * dead-peer eviction without a 30s wait. Production never sets it.
   */
  heartbeatIntervalMs?: number;
}

/**
 * Lightweight snapshot of a connected peer — what status reporters and
 * admin surfaces need to know without holding a reference to the
 * underlying {@link PeerConnection}.
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

/**
 * Start the WS server. Resolves once the underlying socket is bound;
 * rejects if `port` is already in use (callers should surface a clear
 * "another instance running" message rather than crashing).
 */
/**
 * True when an incoming socket's remote address is a loopback address —
 * the peer is a process on this same machine. This is a
 * **reporting + reach** classifier only; it does NOT gate auth. Since A1
 * every peer presents a paired token regardless of origin (loopback is
 * reachable cross-user on a shared box and TCP blocks OS peer-cred, so
 * trust-by-process isn't a sound floor). The classification still matters
 * downstream: a same-device (loopback) peer is the only one allowed to
 * receive same-device-only secrets (the WS-B vault reach gate), and admin
 * surfaces distinguish a loopback peer from a LAN one. IPv4-mapped IPv6
 * loopback (`::ffff:127.0.0.1`) is normalized before the check.
 */
function isLoopbackRemote(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false;
  const addr = remoteAddress.startsWith('::ffff:') ? remoteAddress.slice('::ffff:'.length) : remoteAddress;
  return addr === '::1' || addr.startsWith('127.');
}

/**
 * Classify this server's *bind* address into a {@link BackendReach}
 * tier. Loopback binds (`127.*` / `::1` / `localhost`) only ever serve
 * this machine; any broader bind is reachable by LAN peers. `wan` is not
 * inferred here — a process can't tell NAT / public reachability from
 * its bind alone; a wide-area daemon deployment sets that explicitly.
 */
function bindReach(host: string): BackendReach {
  if (host === '::1' || host === 'localhost' || host.startsWith('127.')) return BACKEND_REACH.LOOPBACK;
  return BACKEND_REACH.LAN;
}

export async function startOracleWsServer(options: OracleWsServerOptions): Promise<OracleWsServer> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? WS_PORT;
  const handshakeIdentity = options.handshakeIdentity;
  const httpRequestHandler = options.httpRequestHandler;
  const classifyLoopback = options.classifyLoopback ?? isLoopbackRemote;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;

  // Own the underlying http.Server so the pairing surface (U3.3) can
  // attach to non-upgrade `request` events on the same bind. Without
  // this, `new WebSocketServer({ host, port })` would spin its own
  // listener and the pairing routes would have to live on a separate
  // port — `data-plane.md` §11.4 calls out single-bind explicitly.
  const httpServer: HttpServer = createHttpServer((req, res) => {
    if (httpRequestHandler?.(req, res)) return;
    // Default: anything that isn't an upgrade and isn't claimed by the
    // pairing handler gets the same 400 the `ws` package emits on its
    // own — that's what the extension's reachability check expects.
    res.statusCode = 400;
    res.end();
  });
  const wss = new WebSocketServer({ server: httpServer });
  await new Promise<void>((resolve, reject) => {
    const onListening = (): void => {
      httpServer.off('error', onError);
      resolve();
    };
    const onError = (err: Error): void => {
      httpServer.off('listening', onListening);
      reject(err);
    };
    httpServer.once('listening', onListening);
    httpServer.once('error', onError);
    httpServer.listen({ host, port });
  });

  logger.info(SCOPE, `listening on ws://${host}:${port}`);

  // Surface this host's reach as live state so its OWN renderer surfaces
  // (desktop workbench / popup) light up the right contextual rows in
  // `useBackendReach` — without piping through the WELCOME path, which
  // only fires for external peers. A bind-change restart overwrites the
  // slot, so flipping the LAN setting flows through automatically.
  const reach = bindReach(host);
  void getHostStorage()
    ?.set(OH.backendReach, reach)
    .catch((err: unknown) => logger.warn(SCOPE, 'failed to publish backendReach', err));

  // Connections past handshake. Only these receive broadcasts.
  const ready = new Set<WebSocket>();
  // PeerConnection per socket — every accepted connection has one.
  // Created on successful HELLO; disposed on socket close.
  const peerBySocket = new Map<WebSocket, PeerConnection>();
  // PeerSummary mirror — used by listConnectedPeers + emitted on
  // subscribePeerChange. Mirrors `peerBySocket` 1:1 so the snapshot
  // read path doesn't touch `PeerConnection` internals.
  const summaryBySocket = new Map<WebSocket, PeerSummary>();
  const peerChangeListeners = new Set<PeerChangeListener>();
  // Liveness flag per socket — set true on any inbound frame (protocol
  // pong or application message), flipped false by each heartbeat sweep
  // before it re-pings. A socket still false at the next sweep is
  // unresponsive and gets terminated. A WeakMap so a closed socket's
  // entry is reclaimed without manual cleanup.
  const alive = new WeakMap<WebSocket, boolean>();
  let closed = false;

  function emitPeerChange(event: PeerChangeEvent): void {
    for (const listener of peerChangeListeners) {
      try {
        listener(event);
      } catch (err) {
        // A misbehaving listener must not prevent other listeners (or
        // the server's own bookkeeping) from completing.
        logger.warn(SCOPE, 'peer-change listener threw', err);
      }
    }
  }

  function send(socket: WebSocket, payload: unknown): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(payload));
    } catch (err) {
      logger.warn(SCOPE, 'send failed', err);
    }
  }

  wss.on('connection', (socket, request) => {
    // Auth is mandatory on every connection. Loopback is reachable
    // cross-user on a shared box and TCP blocks OS peer-cred, so
    // trust-by-process is not a sound floor — every peer presents a
    // paired token. `isLoopback` is kept for reporting + reach, not auth.
    const isLoopback = classifyLoopback(request.socket.remoteAddress);
    const requireAuth = true;
    // Heartbeat bookkeeping — a fresh socket is alive; a protocol-level
    // pong reply re-arms it (the message handler below re-arms on any
    // application frame too).
    alive.set(socket, true);
    socket.on('pong', () => alive.set(socket, true));
    let handshakeDone = false;
    const handshakeTimer = setTimeout(() => {
      if (handshakeDone) return;
      logger.info(SCOPE, 'closing connection: handshake timeout');
      try {
        socket.close(1002, 'handshake timeout');
      } catch {
        // ignore
      }
    }, HANDSHAKE_TIMEOUT_MS);

    socket.on('message', (raw: RawData) => {
      // Any inbound application frame proves the peer is alive — re-arm
      // so a busy peer whose protocol pong was dropped isn't reaped.
      alive.set(socket, true);
      // The handler is wrapped in an async IIFE so the HELLO gate can
      // await the token-store read. Post-handshake branches stay
      // synchronous; only the one async edge runs through the IIFE.
      void (async () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw.toString('utf-8'));
        } catch (err) {
          logger.warn(SCOPE, 'dropping unparseable frame', err);
          return;
        }

        if (!handshakeDone) {
          const frameType = (parsed as { type?: unknown })?.type;
          if (frameType !== SYNC_HELLO_TYPE) {
            logger.warn(SCOPE, `pre-handshake message ${String(frameType)}; expected ${SYNC_HELLO_TYPE}; closing`);
            try {
              socket.close(1002, `expected ${SYNC_HELLO_TYPE}`);
            } catch {
              // ignore
            }
            return;
          }
          let outcome: Awaited<ReturnType<typeof evaluateHello>>;
          try {
            outcome = await evaluateHello(parsed as Record<string, unknown>, handshakeIdentity, {
              requireAuth,
              reach,
            });
          } catch (err) {
            // The HELLO gate awaits a token-store read; a storage fault
            // there must not leave the socket hanging until the 5s
            // handshake timeout. Close it now with an internal-error code.
            logger.warn(SCOPE, 'evaluateHello threw; closing connection', err);
            try {
              socket.close(1011, 'handshake evaluation failed');
            } catch {
              // ignore
            }
            return;
          }
          // The await above (token-store I/O on a LAN bind) is a window
          // in which the peer can drop the socket. The 'close' handler
          // already ran and found no peer to clean up, so registering
          // one now would strand a ghost in `peerBySocket` / `ready`
          // that no future event ever removes — inflating
          // `connectedCount()` / `connectedTokenIds()` permanently.
          if (socket.readyState !== WebSocket.OPEN) {
            logger.info(SCOPE, 'peer closed during HELLO evaluation; abandoning handshake');
            return;
          }
          send(socket, outcome.welcome);
          if (outcome.kind === 'reject') {
            logger.info(SCOPE, `HELLO rejected: ${outcome.reason}`);
            try {
              socket.close(PROTOCOL_INCOMPATIBLE_CLOSE_CODE, outcome.reason);
            } catch {
              // ignore
            }
            return;
          }
          const peerId = randomUUID();
          const peerConn = createPeerConnection({
            peerId,
            nodeId: outcome.hello.nodeId,
            role: outcome.hello.role,
            agent: outcome.hello.agent,
            workspaceId: outcome.hello.workspaceId,
            protocolVersion: outcome.hello.protocolVersion,
            tokenId: outcome.tokenId,
            send: (frame) => {
              if (socket.readyState !== WebSocket.OPEN) return false;
              try {
                socket.send(JSON.stringify(frame));
                return true;
              } catch (err) {
                logger.warn(SCOPE, `peer ${peerId} reply failed`, err);
                return false;
              }
            },
            close: (code, reason) => {
              try {
                socket.close(code ?? 1000, reason);
              } catch {
                // ignore
              }
            },
          });
          peerBySocket.set(socket, peerConn);
          const summary: PeerSummary = {
            peerId: peerConn.peerId,
            role: peerConn.role,
            agent: peerConn.agent,
            workspaceId: peerConn.workspaceId,
            tokenId: peerConn.tokenId,
            isLoopback,
          };
          summaryBySocket.set(socket, summary);
          handshakeDone = true;
          clearTimeout(handshakeTimer);
          ready.add(socket);
          logger.info(
            SCOPE,
            `peer connected (role=${peerConn.role} agent=${peerConn.agent} ws=${peerConn.workspaceId} node=${peerConn.nodeId} protocol=v${peerConn.protocolVersion})`,
          );
          emitPeerChange({ kind: 'connect', peer: summary });
          return;
        }

        if (isPing(parsed)) {
          send(socket, { type: 'pong', t: parsed.t });
          return;
        }

        // STATE_VECTOR is handshake-flow, not RPC — needs streaming reply
        // bound to this socket via the PeerConnection. Only valid for
        // HELLO-connected peers; browserInfo-connected peers (no
        // workspace binding) get a hard reject so the client knows to
        // upgrade.
        if ((parsed as { type?: unknown })?.type === SYNC_STATE_VECTOR_TYPE) {
          const peerConn = peerBySocket.get(socket);
          if (!peerConn) {
            logger.warn(SCOPE, 'STATE_VECTOR from a peer that connected via legacy browserInfo; dropping');
            return;
          }
          void handleStateVector(parsed as Record<string, unknown>, peerConn, {
            // WS-B reach gate on the catch-up path: an off-device peer's
            // snapshot bootstrap + delta replay must omit same-device-only
            // secrets (vault), mirroring the live-broadcast gate so a
            // reconnecting LAN peer can't pull seed history.
            responder: { offDevicePeer: !isLoopback },
          }).catch((err) => {
            logger.warn(SCOPE, `handleStateVector threw for peer ${peerConn.peerId}`, err);
          });
          return;
        }

        const dispatched = dispatchSyncRpc(parsed as Record<string, unknown>);
        if (dispatched === null) {
          // Channel outside the 22 sync+awareness ones. Silently ignore —
          // matches the chrome adapter's pass-through semantics.
          return;
        }
        const responseChannel = `${(parsed as RpcMessage).type}:response`;
        if (dispatched.kind === 'sync') {
          send(socket, { type: responseChannel, payload: dispatched.response });
        } else {
          void dispatched.promise
            .then((resp) => send(socket, { type: responseChannel, payload: resp }))
            .catch((err) => {
              logger.warn(SCOPE, `RPC ${(parsed as RpcMessage).type} threw`, err);
              send(socket, { type: responseChannel, __error: (err as Error)?.message ?? String(err) });
            });
        }
      })();
    });

    socket.on('close', () => {
      clearTimeout(handshakeTimer);
      ready.delete(socket);
      const peerConn = peerBySocket.get(socket);
      if (peerConn) {
        peerBySocket.delete(socket);
        // Flip the PeerConnection's open flag so any in-flight
        // streaming responder iterating its delta stream stops cleanly
        // on the next `reply.send`.
        peerConn.close();
      }
      const summary = summaryBySocket.get(socket);
      if (summary) {
        summaryBySocket.delete(socket);
        emitPeerChange({ kind: 'disconnect', peer: summary });
      }
    });

    socket.on('error', (err) => {
      logger.warn(SCOPE, 'socket error', err);
    });
  });

  // Server-driven liveness sweep. A peer that answered neither the prior
  // PING nor sent any frame since the last tick is terminated; the
  // `terminate()` fires the socket's `'close'` handler, which runs the
  // same registry cleanup + `disconnect` emission as a clean close. The
  // timer is `unref`'d so it never holds the process open on its own.
  const heartbeatTimer = setInterval(() => {
    for (const socket of wss.clients) {
      if (alive.get(socket) === false) {
        socket.terminate();
        continue;
      }
      alive.set(socket, false);
      try {
        socket.ping();
      } catch (err) {
        // A failing ping means the socket is already going away; its
        // `'close'` event (or the next sweep) reaps it.
        logger.warn(SCOPE, 'heartbeat ping failed', err);
      }
    }
  }, heartbeatIntervalMs);
  heartbeatTimer.unref();

  function sendFrameToReady(serialized: string, loopbackOnly: boolean): void {
    for (const socket of ready) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      if (loopbackOnly && !summaryBySocket.get(socket)?.isLoopback) {
        // WS-B reach gate: a same-device-only frame (vault mutation)
        // must not reach an off-device peer. Per-socket reach is only
        // known here, at the transport.
        continue;
      }
      try {
        socket.send(serialized);
      } catch (err) {
        logger.warn(SCOPE, 'broadcast to peer failed', err);
      }
    }
  }

  return {
    broadcast(type, payload) {
      if (closed) return;
      sendFrameToReady(JSON.stringify({ type, payload }), false);
    },
    broadcastFrame(frame, opts) {
      if (closed) return;
      sendFrameToReady(JSON.stringify(frame), opts?.loopbackOnly ?? false);
    },
    connectedCount() {
      return ready.size;
    },
    connectedTokenIds() {
      const ids = new Set<string>();
      for (const peer of peerBySocket.values()) {
        if (peer.tokenId !== null) ids.add(peer.tokenId);
      }
      return ids;
    },
    listConnectedPeers() {
      return [...summaryBySocket.values()];
    },
    subscribePeerChange(listener) {
      peerChangeListeners.add(listener);
      return () => {
        peerChangeListeners.delete(listener);
      };
    },
    async close() {
      if (closed) return;
      closed = true;
      clearInterval(heartbeatTimer);
      for (const peerConn of peerBySocket.values()) peerConn.close(1001, 'server shutting down');
      peerBySocket.clear();
      // Fan a disconnect event per outstanding peer so status reporters
      // settle to "no peers" instead of holding the last known count
      // across a rebind / shutdown.
      for (const summary of summaryBySocket.values()) {
        emitPeerChange({ kind: 'disconnect', peer: summary });
      }
      summaryBySocket.clear();
      peerChangeListeners.clear();
      for (const socket of ready) {
        try {
          socket.close(1001, 'server shutting down');
        } catch {
          // ignore
        }
      }
      ready.clear();
      await new Promise<void>((resolve) => {
        wss.close(() => resolve());
      });
      // `wss.close()` doesn't close the underlying http.Server when the
      // server was supplied by the caller, so the bind would linger
      // until the http.Server's idle-timeout. Close it explicitly so a
      // rebind on the same port doesn't trip EADDRINUSE.
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
      logger.info(SCOPE, 'closed');
    },
  };
}
