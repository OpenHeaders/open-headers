// ── Server lifecycle — bind, heartbeat sweep, broadcast fan-out ─────

import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { setBackendReach } from '@openheaders/core/backends';
import { hostLogger as logger } from '@openheaders/core/logger';
import { WS_PORT } from '@openheaders/core/protocol';
import { SELF_BACKEND_REACH_KEY } from '@openheaders/core/storage';
import { WebSocket, WebSocketServer } from 'ws';
import { bindReach, isLoopbackRemote } from './classify';
import { handleConnection } from './connection';
import type { OracleWsServer, OracleWsServerOptions, PeerSummary } from './contract';
import { createPeerRegistry } from './peer-registry';
import { SCOPE } from './shared';

/**
 * Close code sent when a peer is force-disconnected because its auth
 * token was revoked. 1008 (policy violation) is the standard WS code for
 * "you broke a rule of this server"; the peer's reconnect re-HELLOs and
 * gets `auth-required`, surfacing the re-pair UX (A6).
 */
const TOKEN_REVOKED_CLOSE_CODE = 1008;

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

/**
 * Max inbound WebSocket frame size (bytes). Without this the `ws` default
 * of 100 MiB governs every inbound frame — *including* the first frame
 * from an unauthenticated peer, which is buffered + `JSON.parse`d before
 * the HELLO gate runs. On a LAN bind an unauthenticated peer (or many) can
 * force ~100 MiB allocations pre-auth — a memory-amplification DoS bounded
 * only by that oversized default.
 *
 * 8 MiB clears the largest legitimate client→server frame with wide
 * headroom: every inbound frame is either tiny (HELLO, stateVector, ping,
 * sync RPCs) or a single mutation envelope, whose largest body is a
 * `create`/`setField` carrying user-pasted text (a request body, a
 * workflow definition) — file *bytes* never ride sync, only their
 * `(fileId, hash, filename, mimeType, size)` metadata. An over-cap frame
 * is closed by `ws` with 1009; the large frames in this protocol flow
 * server→client (snapshot/delta), which `maxPayload` does not constrain.
 */
const MAX_INBOUND_FRAME_BYTES = 8 * 1024 * 1024;

/**
 * Max concurrently open WebSocket connections (pre- and post-HELLO).
 * Without this nothing bounds socket *count* — `maxPayload` bounds frame
 * size and the heartbeat sweep reaps dead peers, but on a LAN/WAN-
 * reachable bind an attacker holding sockets open (even ones that never
 * HELLO) rides until OS file-descriptor exhaustion, which takes the
 * whole daemon down — HTTP surface included, since it shares the bind.
 *
 * 256 is generous headroom: a real fleet is tens of peers (one socket
 * per paired device/extension), and the 5s handshake timeout already
 * evicts sockets that never HELLO. An over-cap socket is closed with
 * 1013 ("try again later"), so a legitimate peer arriving during a
 * flood retries instead of failing permanently. Counted against
 * `wss.clients` — the only set that includes pre-HELLO sockets; the
 * registry tracks admitted peers only.
 */
const MAX_CONCURRENT_CONNECTIONS = 256;

/** Close code for an over-cap connection — standard "try again later". */
const OVER_CAPACITY_CLOSE_CODE = 1013;

/**
 * Start the WS server. Resolves once the underlying socket is bound;
 * rejects if `port` is already in use (callers should surface a clear
 * "another instance running" message rather than crashing).
 */
export async function startOracleWsServer(options: OracleWsServerOptions): Promise<OracleWsServer> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? WS_PORT;
  const handshakeIdentity = options.handshakeIdentity;
  const httpRequestHandler = options.httpRequestHandler;
  const classifyLoopback = options.classifyLoopback ?? isLoopbackRemote;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
  const maxConnections = options.maxConnections ?? MAX_CONCURRENT_CONNECTIONS;

  // Own the underlying http.Server so the pairing surface (U3.3) can
  // attach to non-upgrade `request` events on the same bind. Without
  // this, `new WebSocketServer({ host, port })` would spin its own
  // listener and the pairing routes would have to live on a separate
  // port — the data-plane topologies design §11.4 calls out
  // single-bind explicitly.
  const httpServer: HttpServer = createHttpServer((req, res) => {
    if (httpRequestHandler?.(req, res)) return;
    // Default: anything that isn't an upgrade and isn't claimed by the
    // pairing handler gets the same 400 the `ws` package emits on its
    // own — that's what the extension's reachability check expects.
    res.statusCode = 400;
    res.end();
  });
  // Slow-loris posture: every request this bind legitimately serves is
  // small (pairing/OIDC/MCP JSON, healthz, metrics, static assets), so
  // Node's lenient defaults (60s headers / 300s whole-request) only
  // extend how long a drip-feeding peer can hold a socket. WS upgrades
  // are unaffected — an upgraded socket leaves the HTTP timeout
  // machinery.
  httpServer.headersTimeout = 15_000;
  httpServer.requestTimeout = 60_000;
  const wss = new WebSocketServer({ server: httpServer, maxPayload: MAX_INBOUND_FRAME_BYTES });
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
  // only fires for external peers. Keyed under the reserved self entry;
  // a bind-change restart overwrites it, so flipping the LAN setting
  // flows through automatically.
  const reach = bindReach(host);
  void setBackendReach(SELF_BACKEND_REACH_KEY, reach).catch((err: unknown) =>
    logger.warn(SCOPE, 'failed to publish backendReach', err),
  );

  const registry = createPeerRegistry();
  const { ready, peerBySocket, summaryBySocket, peerChangeListeners, alive } = registry;
  let closed = false;

  wss.on('connection', (socket, request) => {
    // Capacity gate — before any per-socket state is wired. `ws` has
    // already completed the 101 by the time `'connection'` fires (same
    // constraint the admission refusal lives with), so refusal is a
    // close, not an HTTP status. `wss.clients` includes this socket.
    if (wss.clients.size > maxConnections) {
      logger.warn(
        SCOPE,
        `connection refused: at capacity (${maxConnections}) (peer=${request.socket.remoteAddress ?? 'unknown'})`,
      );
      try {
        socket.close(OVER_CAPACITY_CLOSE_CODE, 'server at capacity');
      } catch {
        // ignore
      }
      return;
    }
    handleConnection(socket, request, {
      registry,
      handshakeIdentity,
      reach,
      classifyLoopback,
      admission: options.admission,
      peerRpc: options.peerRpc,
      peerPush: options.peerPush,
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

  function sendFrameToReady(
    serialized: string,
    loopbackOnly: boolean,
    excludeNodeId?: string,
    filterPeer?: (peer: PeerSummary) => boolean,
  ): void {
    for (const socket of ready) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      const summary = summaryBySocket.get(socket);
      if (loopbackOnly && !summary?.isLoopback) {
        // WS-B reach gate: a same-device-only frame (vault mutation)
        // must not reach an off-device peer. Per-socket reach is only
        // known here, at the transport.
        continue;
      }
      if (excludeNodeId !== undefined && summary?.nodeId === excludeNodeId) {
        // Hub relay: never bounce a mutation back to the peer that
        // minted it. Per-socket identity is only known here.
        continue;
      }
      if (filterPeer !== undefined && summary !== undefined && !filterPeer(summary)) {
        // RBAC read gate (Phase 5 slice 2): the caller resolved which
        // peers may read this frame's workspace; skip the rest.
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
      sendFrameToReady(JSON.stringify(frame), opts?.loopbackOnly ?? false, opts?.excludeNodeId, opts?.filterPeer);
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
    closePeersByTokenId(tokenId) {
      if (closed) return 0;
      let count = 0;
      // Snapshot first — closing a socket mutates `peerBySocket` from the
      // synchronous `'close'` handler, so iterating it live would skip
      // entries.
      const victims: WebSocket[] = [];
      for (const [socket, peer] of peerBySocket) {
        if (peer.tokenId === tokenId) victims.push(socket);
      }
      for (const socket of victims) {
        try {
          socket.close(TOKEN_REVOKED_CLOSE_CODE, 'token revoked');
        } catch (err) {
          logger.warn(SCOPE, 'closePeersByTokenId close failed', err);
        }
        count++;
      }
      if (count > 0) logger.info(SCOPE, `evicted ${count} peer(s) for revoked token`);
      return count;
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
        registry.emitPeerChange({ kind: 'disconnect', peer: summary });
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
