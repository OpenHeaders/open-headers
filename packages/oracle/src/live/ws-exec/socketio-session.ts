/**
 * Socket.IO session controller — the host-neutral protocol driver the
 * WS executor mounts ABOVE the protocol-blind transport seam when the
 * request's flavor is `socketio` (the S6 checkpoint). It owns the two
 * wire obligations a live engine.io session carries:
 *
 *   - the namespace CONNECT packet, sent once the server's engine.io
 *     open packet arrives (never at WS open — the protocol orders the
 *     client's first write after the open frame) — carrying the
 *     session credential's auth payload when one is configured;
 *   - the heartbeat: every server ping (`2`) answers with the pong
 *     (`3`) so the server's ping timeout never severs the session.
 *
 * The protocol revision decides who carries each obligation. On v5
 * (`EIO=4`, the default) the server pings and every namespace — the
 * root included — is CONNECTed by the client, auth payload allowed.
 * On v4 (`EIO=3`, Socket.IO 1.x / 2.x servers) the CLIENT pings every
 * `pingInterval` and the server pongs, the server connects the root
 * namespace itself (a client CONNECT goes out for any other), and the
 * CONNECT packet carries no payload — the bearer stays a handshake
 * header there.
 *
 * It also owns the ack registry: an EVENT sent with the ack opt-in
 * arms its id against the request's ack timeout; the server's ACK on
 * the namespace clears it, a spent wait reports the id as timed out
 * (the official client's `ackTimeout` rule — the ack is dropped, a
 * late ACK still captures like any frame). No timeout = wait forever.
 *
 * It also reports the two facts the executor's resilience plane needs
 * and cannot read off the frames itself: the handshake's ping cadence
 * (the open packet's `pingInterval` + `pingTimeout` — the official
 * client's liveness deadline) and a server DISCONNECT packet on the
 * session's namespace (the server said goodbye on purpose — the one
 * drop auto-reconnect never redials). A reconnected connection starts
 * the obligations over (`resetConnection` — pending acks and the ping
 * timer are dropped with the connection); ack ids keep counting
 * across connections so every compose stays uniquely correlated.
 *
 * Every write goes through the executor's `sendFrame` closure, so the
 * protocol frames are captured and broadcast VERBATIM like any other
 * ↑ message (the capture law — display decodes them into subdued
 * control rows). The grammar itself lives in `@openheaders/core/socketio`
 * — one module shared with the display decode.
 */

import {
  ENGINE_IO_PING_FRAME,
  ENGINE_IO_PONG_FRAME,
  encodeConnectPacket,
  parseEngineIoFrame,
  SOCKET_IO_PACKET_TYPES,
  type SocketIoProtocolRevision,
} from '@openheaders/core/socketio';

export interface SocketIoSessionController {
  /** Feed one inbound TEXT frame — answers protocol obligations
   *  (open → namespace CONNECT, ping → pong, pong → the next ping on
   *  v4, ACK → the pending ack) through `sendFrame`. */
  handleFrame(text: string): void;
  /** Mint the next ack correlation id for an EVENT compose. */
  nextAckId(): number;
  /** The EVENT carrying `ackId` left the wire — start its ack wait
   *  (a no-op without an ack timeout). */
  armAck(ackId: number): void;
  /** The connection ended (a redial follows, or the session settled)
   *  — the namespace CONNECT is owed again on the next open packet;
   *  the ping timer and every pending ack drop with the connection. */
  resetConnection(): void;
}

export interface SocketIoSessionHooks {
  /** The engine.io open packet arrived with its ping cadence (ms);
   *  either absent when the server omitted it. */
  onHandshake?(cadence: { pingIntervalMs?: number; pingTimeoutMs?: number }): void;
  /** The server sent DISCONNECT for the session's namespace. */
  onServerDisconnect?(): void;
  /** An armed ack's wait ran out without the server's ACK. */
  onAckTimeout?(ackId: number, timeoutMs: number): void;
}

export interface SocketIoSessionOptions {
  /** The socket.io revision the session speaks. */
  protocol: SocketIoProtocolRevision;
  /** CONNECT auth payload as JSON text (v5 only — v4 has no CONNECT
   *  payload and the controller never writes one there). */
  connectAuthJson?: string;
  /** Wait (ms) for an ACK once armed; absent = wait forever. */
  ackTimeoutMs?: number;
}

export function createSocketIoSessionController(
  namespace: string,
  sendFrame: (text: string) => void,
  options: SocketIoSessionOptions,
  hooks: SocketIoSessionHooks = {},
): SocketIoSessionController {
  const legacy = options.protocol === 4;
  let ackId = 0;
  let connectSent = false;
  let pingIntervalMs: number | undefined;
  let pingTimer: ReturnType<typeof setTimeout> | null = null;
  const pendingAcks = new Map<number, ReturnType<typeof setTimeout>>();

  const clearPingTimer = (): void => {
    if (pingTimer !== null) clearTimeout(pingTimer);
    pingTimer = null;
  };
  /** v4: the client's ping is due `pingInterval` after the open
   *  packet and after every pong (the official client's `setPing`);
   *  a pong that never comes is the liveness deadline's call. */
  const schedulePing = (): void => {
    clearPingTimer();
    if (!legacy || pingIntervalMs === undefined) return;
    pingTimer = setTimeout(() => {
      pingTimer = null;
      sendFrame(ENGINE_IO_PING_FRAME);
    }, pingIntervalMs);
  };
  const clearPendingAcks = (): void => {
    for (const timer of pendingAcks.values()) clearTimeout(timer);
    pendingAcks.clear();
  };

  return {
    handleFrame(text) {
      const frame = parseEngineIoFrame(text);
      if (frame.kind === 'open') {
        // A duplicate open frame would be a server bug — the guard
        // keeps the CONNECT single either way. v4 connects the root
        // namespace server-side and takes no payload.
        if (!connectSent) {
          connectSent = true;
          if (!legacy) sendFrame(encodeConnectPacket(namespace, options.connectAuthJson));
          else if (namespace !== '/') sendFrame(encodeConnectPacket(namespace));
        }
        const cadence = handshakeCadence(frame.dataJson);
        pingIntervalMs = cadence.pingIntervalMs;
        schedulePing();
        hooks.onHandshake?.(cadence);
        return;
      }
      if (frame.kind === 'ping') {
        sendFrame(ENGINE_IO_PONG_FRAME);
        return;
      }
      if (frame.kind === 'pong') {
        schedulePing();
        return;
      }
      if (frame.kind !== 'packet' || frame.packet.namespace !== namespace) return;
      if (frame.packet.type === SOCKET_IO_PACKET_TYPES.disconnect) {
        hooks.onServerDisconnect?.();
        return;
      }
      if (
        (frame.packet.type === SOCKET_IO_PACKET_TYPES.ack || frame.packet.type === SOCKET_IO_PACKET_TYPES.binaryAck) &&
        frame.packet.ackId !== null
      ) {
        const timer = pendingAcks.get(frame.packet.ackId);
        if (timer !== undefined) {
          clearTimeout(timer);
          pendingAcks.delete(frame.packet.ackId);
        }
      }
    },
    nextAckId() {
      ackId += 1;
      return ackId;
    },
    armAck(id) {
      const timeoutMs = options.ackTimeoutMs;
      if (timeoutMs === undefined) return;
      pendingAcks.set(
        id,
        setTimeout(() => {
          pendingAcks.delete(id);
          hooks.onAckTimeout?.(id, timeoutMs);
        }, timeoutMs),
      );
    },
    resetConnection() {
      connectSent = false;
      pingIntervalMs = undefined;
      clearPingTimer();
      clearPendingAcks();
    },
  };
}

/** The open packet's ping cadence, read tolerantly — a malformed or
 *  partial payload yields no numbers rather than a throw. */
function handshakeCadence(dataJson: string): { pingIntervalMs?: number; pingTimeoutMs?: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataJson);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null) return {};
  const record = parsed as Record<string, unknown>;
  const pingInterval = record.pingInterval;
  const pingTimeout = record.pingTimeout;
  return {
    ...(typeof pingInterval === 'number' && pingInterval > 0 ? { pingIntervalMs: pingInterval } : {}),
    ...(typeof pingTimeout === 'number' && pingTimeout > 0 ? { pingTimeoutMs: pingTimeout } : {}),
  };
}
