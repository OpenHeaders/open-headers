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
 *   - **Handshake.** First message from each peer is
 *     `{ type: 'browserInfo', protocolVersion, browser, version,
 *     extensionVersion }` (the extension client's `sendBrowserInfo`).
 *     If `protocolVersion` falls outside
 *     `[MIN_COMPATIBLE_PROTOCOL, PROTOCOL_VERSION]`, the server closes
 *     the socket with `PROTOCOL_INCOMPATIBLE_CLOSE_CODE` (4001) so the
 *     extension surfaces "update extension" instead of generic
 *     disconnect noise.
 *   - **Keep-alive.** The extension sends
 *     `{ type: 'ping', t: <ms> }` on `backend.pingIntervalMs`.
 *     The server replies with `{ type: 'pong', t: <ms> }` so the client
 *     can measure round-trip if it ever cares; today it doesn't use
 *     pong but a silent server would have to choose between idle-
 *     timeout disconnects and never-cleaning-up half-dead sockets, and
 *     this is cheaper.
 *   - **Sync RPCs.** Anything else routes through {@link dispatchSyncRpc}
 *     (the same dispatcher the IPC handler uses). When the dispatcher
 *     recognizes the channel and returns a response, the server sends
 *     `{ type: '<rpc>:response', ...payload }` back over the same
 *     connection. Channels outside the 22 sync+awareness ones are
 *     silently ignored — same "ignore-extension-internal-messages"
 *     semantics the chrome adapter has.
 *   - **Broadcasts.** {@link broadcast} fans an oracle event out to
 *     every connected peer that has completed its handshake. The host
 *     wires this into `OracleHostHooks.broadcastSyncEvent` /
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

import {
  isCompatibleProtocol,
  PROTOCOL_INCOMPATIBLE_CLOSE_CODE,
  PROTOCOL_VERSION,
} from '@openheaders/core/protocol';
import { hostLogger as logger } from '@openheaders/core/logger';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { dispatchSyncRpc } from '../rpc';

const SCOPE = 'OracleWsServer';
const HANDSHAKE_TIMEOUT_MS = 5_000;

interface BrowserInfoMessage {
  type: 'browserInfo';
  protocolVersion: number;
  browser?: string;
  version?: string;
  extensionVersion?: string;
}

interface PingMessage {
  type: 'ping';
  t?: number;
}

interface RpcMessage {
  type: string;
  [key: string]: unknown;
}

function isBrowserInfo(m: unknown): m is BrowserInfoMessage {
  return Boolean(m && typeof m === 'object' && (m as { type?: unknown }).type === 'browserInfo');
}
function isPing(m: unknown): m is PingMessage {
  return Boolean(m && typeof m === 'object' && (m as { type?: unknown }).type === 'ping');
}

export interface OracleWsServerOptions {
  /** Bind address — `127.0.0.1` for local-only, `0.0.0.0` for LAN. */
  host?: string;
  /** TCP port; default 59210 matches the extension's setting. */
  port?: number;
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
export async function startOracleWsServer(options: OracleWsServerOptions = {}): Promise<OracleWsServer> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 59210;

  const wss = new WebSocketServer({ host, port });
  await new Promise<void>((resolve, reject) => {
    const onListening = (): void => {
      wss.off('error', onError);
      resolve();
    };
    const onError = (err: Error): void => {
      wss.off('listening', onListening);
      reject(err);
    };
    wss.once('listening', onListening);
    wss.once('error', onError);
  });

  logger.info(SCOPE, `listening on ws://${host}:${port}`);

  // Connections past handshake. Only these receive broadcasts.
  const ready = new Set<WebSocket>();
  let closed = false;

  function rejectIncompatible(socket: WebSocket, peerVersion: number): void {
    const reason = JSON.stringify({
      type: 'incompatible-protocol',
      peerVersion,
      ourVersion: PROTOCOL_VERSION,
    });
    try {
      socket.close(PROTOCOL_INCOMPATIBLE_CLOSE_CODE, reason);
    } catch {
      // socket already half-closed; nothing to do
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
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString('utf-8'));
      } catch (err) {
        logger.warn(SCOPE, 'dropping unparseable frame', err);
        return;
      }

      if (!handshakeDone) {
        if (!isBrowserInfo(parsed)) {
          // Pre-handshake messages other than browserInfo are protocol
          // violations from the client's side. Close hard so the client
          // shows "Connecting…" → "Reconnecting".
          logger.warn(SCOPE, `pre-handshake message ${(parsed as RpcMessage)?.type}; closing`);
          try {
            socket.close(1002, 'expected browserInfo');
          } catch {
            // ignore
          }
          return;
        }
        if (!isCompatibleProtocol(parsed.protocolVersion)) {
          logger.info(
            SCOPE,
            `rejecting peer (protocol v${parsed.protocolVersion}; we speak v${PROTOCOL_VERSION})`,
          );
          rejectIncompatible(socket, parsed.protocolVersion);
          return;
        }
        handshakeDone = true;
        clearTimeout(handshakeTimer);
        ready.add(socket);
        logger.info(
          SCOPE,
          `peer connected (${parsed.browser ?? 'unknown'} ${parsed.version ?? ''}, ext ${parsed.extensionVersion ?? '?'}, protocol v${parsed.protocolVersion})`,
        );
        return;
      }

      if (isPing(parsed)) {
        send(socket, { type: 'pong', t: parsed.t });
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
    });

    socket.on('close', () => {
      clearTimeout(handshakeTimer);
      ready.delete(socket);
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
      logger.info(SCOPE, 'closed');
    },
  };
}
