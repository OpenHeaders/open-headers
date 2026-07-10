// ── Per-socket lifecycle — handshake gate, dispatch, cleanup ────────

import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { hostLogger as logger } from '@openheaders/core/logger';
import {
  type BackendReach,
  HANDSHAKE_REJECT_CLOSE_CODE,
  HANDSHAKE_REJECT_REASONS,
  PROTOCOL_INCOMPATIBLE_CLOSE_CODE,
  SYNC_HELLO_TYPE,
  SYNC_STATE_VECTOR_TYPE,
} from '@openheaders/core/protocol';
import { createPeerConnection } from '@openheaders/oracle/host-runtime/peer-connection';
import {
  dispatchSyncRpc,
  evaluateHello,
  handleStateVector,
  type LocalHandshakeIdentity,
} from '@openheaders/oracle/rpc';
import { type RawData, WebSocket } from 'ws';
import type { PeerSummary, WsAdmissionHooks } from './contract';
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
}

/**
 * Wire up one accepted socket: heartbeat bookkeeping, the HELLO
 * handshake gate, ping/state-vector/RPC dispatch, and close/error
 * cleanup. All shared state lives in `deps.registry`.
 */
export function handleConnection(socket: WebSocket, request: IncomingMessage, deps: ConnectionDeps): void {
  const { registry, handshakeIdentity, reach, classifyLoopback, admission } = deps;
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
          workspaceId: peerConn.workspaceId,
          nodeId: peerConn.nodeId,
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

      // RBAC subject (Phase 5 slice 2): every capability decision for a
      // peer-originated frame runs as the user the peer authenticated as
      // — never this host's own LocalAdmin. `claims` is absent only on
      // the `requireAuth`-off test seam, which keeps local-subject
      // semantics.
      const peerClaims = peerBySocket.get(socket)?.claims;
      const dispatched = dispatchSyncRpc(
        parsed as Record<string, unknown>,
        peerClaims ? { userId: peerClaims.userId, deviceId: peerClaims.deviceId } : undefined,
      );
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
      registry.emitPeerChange({ kind: 'disconnect', peer: summary });
    }
  });

  socket.on('error', (err) => {
    logger.warn(SCOPE, 'socket error', err);
  });
}
