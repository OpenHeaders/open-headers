/**
 * WebSocket server for host-side oracle access — the "extension-as-client
 * of desktop / daemon" pipe (`docs/refactor-status.md` Desktop host #2
 * Stage 2 commit 9; `.notes/oracle-arc.md` Mode 2 / Mode 3).
 *
 * Lives in `@openheaders/oracle/host-runtime` rather than apps/desktop
 * so any Node host can reuse it — Electron main today, a headless Node
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
 * Mode 2 deployments override with `host: '0.0.0.0'` + their own auth
 * (out of scope here).
 */

import { randomUUID } from 'node:crypto';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { hostLogger as logger } from '@openheaders/core/logger';
import {
  PROTOCOL_INCOMPATIBLE_CLOSE_CODE,
  SYNC_HELLO_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  WS_PORT,
} from '@openheaders/core/protocol';
import { type RawData, WebSocket, WebSocketServer } from 'ws';
import { dispatchSyncRpc } from '../rpc';
import { evaluateHello, handleStateVector, type LocalHandshakeIdentity } from '../rpc/handshake-dispatch';
import type { PairingHttpHandler } from './pairing-http';
import { createPeerConnection, type PeerConnection } from './peer-connection';

const SCOPE = 'OracleWsServer';
const HANDSHAKE_TIMEOUT_MS = 5_000;

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
}

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
   */
  broadcastFrame(frame: Record<string, unknown>): void;
  /** Number of connected peers past handshake — used for status logs. */
  connectedCount(): number;
  /** Stop accepting connections and close all open ones. Idempotent. */
  close(): Promise<void>;
}

/**
 * Start the WS server. Resolves once the underlying socket is bound;
 * rejects if `port` is already in use (callers should surface a clear
 * "another instance running" message rather than crashing).
 */
/**
 * Loopback bind addresses that stay trust-by-process per
 * `UNIFIED_ORACLE_MODEL.md` §4.2 + §11.4. Anything else implies a LAN
 * (or tunneled) bind and switches the handshake into auth-required
 * mode via {@link evaluateHello}'s `requireAuth` option.
 */
const LOOPBACK_BINDS: ReadonlySet<string> = new Set(['127.0.0.1', '::1', 'localhost']);

export async function startOracleWsServer(options: OracleWsServerOptions): Promise<OracleWsServer> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? WS_PORT;
  const handshakeIdentity = options.handshakeIdentity;
  const httpRequestHandler = options.httpRequestHandler;
  const requireAuth = !LOOPBACK_BINDS.has(host);

  // Own the underlying http.Server so the pairing surface (U3.3) can
  // attach to non-upgrade `request` events on the same bind. Without
  // this, `new WebSocketServer({ host, port })` would spin its own
  // listener and the pairing routes would have to live on a separate
  // port — `data-plane.md` §11.4 calls out single-bind explicitly.
  const httpServer: HttpServer = createHttpServer((req, res) => {
    if (httpRequestHandler && httpRequestHandler(req, res)) return;
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

  // Connections past handshake. Only these receive broadcasts.
  const ready = new Set<WebSocket>();
  // PeerConnection per socket — every accepted connection has one.
  // Created on successful HELLO; disposed on socket close.
  const peerBySocket = new Map<WebSocket, PeerConnection>();
  let closed = false;

  function send(socket: WebSocket, payload: unknown): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(payload));
    } catch (err) {
      logger.warn(SCOPE, 'send failed', err);
    }
  }

  wss.on('connection', (socket) => {
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
          const outcome = await evaluateHello(parsed as Record<string, unknown>, handshakeIdentity, {
            requireAuth,
          });
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
          handshakeDone = true;
          clearTimeout(handshakeTimer);
          ready.add(socket);
          logger.info(
            SCOPE,
            `peer connected (role=${peerConn.role} agent=${peerConn.agent} ws=${peerConn.workspaceId} node=${peerConn.nodeId} protocol=v${peerConn.protocolVersion})`,
          );
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
          void handleStateVector(parsed as Record<string, unknown>, peerConn).catch((err) => {
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
    });

    socket.on('error', (err) => {
      logger.warn(SCOPE, 'socket error', err);
    });
  });

  function sendFrameToReady(serialized: string): void {
    for (const socket of ready) {
      if (socket.readyState !== WebSocket.OPEN) continue;
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
      sendFrameToReady(JSON.stringify({ type, payload }));
    },
    broadcastFrame(frame) {
      if (closed) return;
      sendFrameToReady(JSON.stringify(frame));
    },
    connectedCount() {
      return ready.size;
    },
    async close() {
      if (closed) return;
      closed = true;
      for (const peerConn of peerBySocket.values()) peerConn.close(1001, 'server shutting down');
      peerBySocket.clear();
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
