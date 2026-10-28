// ── Per-socket lifecycle — handshake gate, dispatch, cleanup ────────
//
// Inbound order. A socket's APPLY-FAMILY frames — `oh.sync.mutation`,
// `oh.sync.mutationBatch` and the web tab's `oh.sync.apply`, the three
// whose handler takes the entity lock — are chained on one per-socket
// tail and processed strictly in arrival order, the discipline the
// client connection manager holds for its wires. Dispatching them
// concurrently raced every apply of one entity onto one FIFO lock: a
// reconnect flush of a few hundred edits queued the tail of them past
// the lock's acquisition timeout, each late apply threw, the error reply
// had no consumer, the client had acked at send, and the lost envelopes
// sat below the hub's vector forever. Serialized, one socket's applies
// land in the order the client sent them (HLC order for a flush) and
// the entity lock arbitrates only BETWEEN writers, never within one
// socket's stream. Every other frame keeps its immediate dispatch:
// pings so the heartbeat is never starved, push frames for their hot
// path, STATE_VECTOR because the client sends it before any flush, and
// the peer RPC planes because a delegated send can run for seconds and
// its Stop is a later frame on the same socket. A tailed frame captures
// its peer at arrival and is dropped if the socket closed while it
// queued — it never dispatches without claims.

import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { hostLogger as logger } from '@openheaders/core/logger';
import {
  type BackendReach,
  HANDSHAKE_REJECT_CLOSE_CODE,
  HANDSHAKE_REJECT_REASONS,
  PROTOCOL_INCOMPATIBLE_CLOSE_CODE,
  SYNC_APPLY_TYPE,
  SYNC_HELLO_TYPE,
  SYNC_MUTATION_BATCH_TYPE,
  SYNC_MUTATION_TYPE,
  SYNC_STATE_VECTOR_TYPE,
} from '@openheaders/core/protocol';
import { createPeerConnection, type PeerClaims } from '@openheaders/oracle/host-runtime/peer-connection';
import {
  dispatchSyncRpc,
  evaluateHello,
  handleStateVector,
  type LocalHandshakeIdentity,
} from '@openheaders/oracle/rpc';
import { type RawData, WebSocket } from 'ws';
import type { PeerSummary, WsAdmissionHooks, WsPeerPushHooks, WsPeerRpcHooks } from './contract';
import type { PeerRegistry } from './peer-registry';
import { SCOPE } from './shared';

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

/** The frames whose handler takes the entity lock — the per-socket tail's family. */
function isApplyFamilyFrame(type: unknown): boolean {
  return type === SYNC_MUTATION_TYPE || type === SYNC_MUTATION_BATCH_TYPE || type === SYNC_APPLY_TYPE;
}

function send(socket: WebSocket, payload: unknown): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify(payload));
  } catch (err) {
    logger.warn(SCOPE, 'send failed', err);
  }
}

export interface ConnectionDeps {
  registry: PeerRegistry;
  handshakeIdentity: LocalHandshakeIdentity;
  /** This server's bind-reach tier — advertised through the HELLO gate. */
  reach: BackendReach;
  classifyLoopback: (remoteAddress: string | undefined) => boolean;
  /** Optional Phase-3 admission seam — see {@link WsAdmissionHooks}. */
  admission?: WsAdmissionHooks;
  /** Optional peer-facing RPC seam — see {@link WsPeerRpcHooks}. */
  peerRpc?: WsPeerRpcHooks;
  /** Optional peer-facing push seam — see {@link WsPeerPushHooks}. */
  peerPush?: WsPeerPushHooks;
}

/**
 * Wire up one accepted socket: heartbeat bookkeeping, the HELLO
 * handshake gate, ping/state-vector/RPC dispatch, and close/error
 * cleanup. All shared state lives in `deps.registry`.
 */
export function handleConnection(socket: WebSocket, request: IncomingMessage, deps: ConnectionDeps): void {
  const { registry, handshakeIdentity, reach, classifyLoopback, admission, peerRpc, peerPush } = deps;
  const { ready, peerBySocket, summaryBySocket, alive } = registry;
  // Auth is mandatory on every connection. Loopback is reachable
  // cross-user on a shared box and TCP blocks OS peer-cred, so
  // trust-by-process is not a sound floor — every peer presents a
  // paired token. `isLoopback` is kept for reporting + reach, not auth.
  // It classifies the RESOLVED peer, not the socket: behind a trusted
  // reverse proxy every socket is loopback, and the same-device vault
  // reach gate must not treat a forwarded WAN client as same-device.
  const remoteAddress = admission?.resolvePeer(request) ?? request.socket.remoteAddress ?? 'unknown';
  const isLoopback = classifyLoopback(remoteAddress);
  const requireAuth = true;
  // Phase-3 admission — Origin/Host matrix + brute-force throttle,
  // evaluated before any protocol state exists. `ws` has already
  // completed the 101 by the time `'connection'` fires, so a refusal is
  // a policy-violation close rather than an HTTP status; the peer never
  // reaches the HELLO gate.
  if (admission) {
    const verdict = admission.admitUpgrade(request);
    if (!verdict.ok) {
      logger.info(SCOPE, `upgrade rejected: ${verdict.reason} (peer=${remoteAddress})`);
      try {
        socket.close(1008, verdict.reason);
      } catch {
        // ignore
      }
      return;
    }
  }
  // Heartbeat bookkeeping — a fresh socket is alive; a protocol-level
  // pong reply re-arms it (the message handler below re-arms on any
  // application frame too).
  alive.set(socket, true);
  socket.on('pong', () => alive.set(socket, true));
  let handshakeDone = false;
  // The apply-family tail (the header). Never rejects: each link
  // answers its own frame, error reply included, so the chain cannot
  // latch into a failed state.
  let inboundTail: Promise<void> = Promise.resolve();

  /**
   * Dispatch one frame through the sync dispatcher as the authenticated
   * peer and answer it on the standard `<type>:response` channel — the
   * payload on success, `__error` on a throw. Ownership is decided
   * synchronously: `null` means the dispatcher does not own the channel
   * and the caller routes onward; otherwise the returned promise settles
   * once the reply is on the wire and never rejects.
   */
  function dispatchSyncFrame(message: RpcMessage, peerClaims: PeerClaims | null): Promise<void> | null {
    const dispatched = dispatchSyncRpc(
      message as Record<string, unknown>,
      peerClaims ? { userId: peerClaims.userId, deviceId: peerClaims.deviceId } : undefined,
    );
    if (dispatched === null) return null;
    const responseChannel = `${message.type}:response`;
    if (dispatched.kind === 'sync') {
      send(socket, { type: responseChannel, payload: dispatched.response });
      return Promise.resolve();
    }
    return dispatched.promise.then(
      (resp) => send(socket, { type: responseChannel, payload: resp }),
      (err) => {
        logger.warn(SCOPE, `RPC ${message.type} threw`, err);
        send(socket, { type: responseChannel, __error: (err as Error)?.message ?? String(err) });
      },
    );
  }

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
          // One line per rejection with reason + peer — the auth-log
          // contract log scanners (fail2ban) match against.
          logger.info(SCOPE, `HELLO rejected: ${outcome.reason} (peer=${remoteAddress})`);
          // Only authentication failures feed the brute-force limiter —
          // a protocol-band or workspace mismatch is a version skew, not
          // a guessing attack.
          if (outcome.reason === HANDSHAKE_REJECT_REASONS.AUTH_REQUIRED) {
            admission?.recordAuthFailure(request);
          }
          // 4001 is reserved for protocol mismatches; every other
          // refusal closes with the policy-violation code and carries
          // the reject reason as the close reason, matching the in-band
          // WELCOME the peer already received.
          const closeCode =
            outcome.reason === 'protocol-too-old' || outcome.reason === 'protocol-too-new'
              ? PROTOCOL_INCOMPATIBLE_CLOSE_CODE
              : HANDSHAKE_REJECT_CLOSE_CODE;
          try {
            socket.close(closeCode, outcome.reason);
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
          claims: outcome.claims,
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
          ...(outcome.hello.browser ? { browser: outcome.hello.browser } : {}),
          workspaceId: peerConn.workspaceId,
          nodeId: peerConn.nodeId,
          installId: outcome.hello.installId ?? null,
          tokenId: peerConn.tokenId,
          userId: peerConn.claims?.userId ?? null,
          isLoopback,
        };
        summaryBySocket.set(socket, summary);
        handshakeDone = true;
        clearTimeout(handshakeTimer);
        ready.add(socket);
        logger.info(
          SCOPE,
          `peer connected (role=${peerConn.role} agent=${peerConn.agent} ws=${peerConn.workspaceId} node=${peerConn.nodeId} protocol=v${peerConn.protocolVersion} user=${peerConn.claims?.userId ?? 'none'})`,
        );
        registry.emitPeerChange({ kind: 'connect', peer: summary });
        return;
      }

      if (isPing(parsed)) {
        send(socket, { type: 'pong', t: parsed.t });
        return;
      }

      // STATE_VECTOR is handshake-flow, not RPC — needs streaming reply
      // bound to this socket via the PeerConnection. Post-handshake the
      // registry entry is always present; it can only be missing when
      // the socket's 'close' handler ran while this frame's async IIFE
      // was still queued, so the frame is dropped rather than answered
      // on a dead socket.
      if ((parsed as { type?: unknown })?.type === SYNC_STATE_VECTOR_TYPE) {
        const peerConn = peerBySocket.get(socket);
        if (!peerConn) {
          logger.warn(SCOPE, 'STATE_VECTOR raced the socket close; dropping');
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

      // Push seam (telemetry plane): one-way frames the consumer never
      // answers. Consulted ahead of the sync/RPC dispatch so the hot
      // streaming path costs one map lookup and no reply machinery.
      // Routed by the peer's REGISTRY summary — the frame can't claim a
      // foreign identity.
      const pushType = (parsed as RpcMessage).type;
      if (peerPush && typeof pushType === 'string' && peerPush.owns(pushType)) {
        const summary = summaryBySocket.get(socket);
        if (summary) {
          try {
            peerPush.handle(parsed as Record<string, unknown>, summary);
          } catch (err) {
            logger.warn(SCOPE, `push handler for ${pushType} threw`, err);
          }
        }
        return;
      }

      // Apply-family frames ride the per-socket tail (the header). The
      // peer is captured NOW, synchronously with arrival; the link
      // re-checks it is still open when its turn comes, because a frame
      // that queued behind a slow apply must never dispatch as the
      // local subject after the socket's 'close' emptied the registry.
      if (isApplyFamilyFrame(pushType)) {
        const peerConn = peerBySocket.get(socket);
        if (!peerConn) {
          logger.warn(SCOPE, `${pushType} raced the socket close; dropping`);
          return;
        }
        inboundTail = inboundTail.then(() => {
          if (!peerConn.isOpen()) {
            logger.info(SCOPE, `peer ${peerConn.peerId} closed with ${pushType} queued; dropping`);
            return;
          }
          return dispatchSyncFrame(parsed as RpcMessage, peerConn.claims) ?? undefined;
        });
        return;
      }

      // RBAC subject (Phase 5 slice 2): every capability decision for a
      // peer-originated frame runs as the user the peer authenticated as
      // — never this host's own LocalAdmin. `claims` is absent only on
      // the `requireAuth`-off test seam, which keeps local-subject
      // semantics.
      const peerClaims = peerBySocket.get(socket)?.claims ?? null;
      const owned = dispatchSyncFrame(parsed as RpcMessage, peerClaims);
      if (owned !== null) {
        void owned;
        return;
      }
      // Peer-facing RPC seam (admin-console slice): channels the sync
      // dispatcher does not own may be claimed here, dispatched as the
      // authenticated peer. Claims-less connections (the
      // `requireAuth`-off test seam) have no subject to gate as and
      // fall through to the silent ignore.
      const frameType = (parsed as RpcMessage).type;
      if (peerRpc && peerClaims && peerRpc.owns(frameType)) {
        const responseChannel = `${frameType}:response`;
        void peerRpc
          .dispatch(parsed as Record<string, unknown>, {
            userId: peerClaims.userId,
            deviceId: peerClaims.deviceId,
            isLoopback: summaryBySocket.get(socket)?.isLoopback ?? false,
          })
          .then((resp) => send(socket, { type: responseChannel, payload: resp }))
          .catch((err) => {
            send(socket, { type: responseChannel, __error: (err as Error)?.message ?? String(err) });
          });
        return;
      }
      // Channel outside the 22 sync+awareness ones. Silently ignore —
      // matches the chrome adapter's pass-through semantics.
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
      registry.emitPeerChange({ kind: 'disconnect', peer: summary });
    }
  });

  socket.on('error', (err) => {
    logger.warn(SCOPE, 'socket error', err);
  });
}
