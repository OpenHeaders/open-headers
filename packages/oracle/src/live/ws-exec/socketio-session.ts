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
 * It also reports the two facts the executor's resilience plane needs
 * and cannot read off the frames itself: the handshake's ping cadence
 * (the open packet's `pingInterval` + `pingTimeout` — the official
 * client's liveness deadline) and a server DISCONNECT packet on the
 * session's namespace (the server said goodbye on purpose — the one
 * drop auto-reconnect never redials). A reconnected connection starts
 * the obligations over (`resetConnection`); ack ids keep counting
 * across connections so every compose stays uniquely correlated.
 *
 * Every write goes through the executor's `sendFrame` closure, so the
 * protocol frames are captured and broadcast VERBATIM like any other
 * ↑ message (the capture law — display decodes them into subdued
 * control rows). The grammar itself lives in `@openheaders/core/socketio`
 * — one module shared with the display decode.
 */

import {
  ENGINE_IO_PONG_FRAME,
  encodeConnectPacket,
  parseEngineIoFrame,
  SOCKET_IO_PACKET_TYPES,
} from '@openheaders/core/socketio';

export interface SocketIoSessionController {
  /** Feed one inbound TEXT frame — answers protocol obligations
   *  (open → namespace CONNECT, ping → pong) through `sendFrame`. */
  handleFrame(text: string): void;
  /** Mint the next ack correlation id for an EVENT compose. */
  nextAckId(): number;
  /** A new connection replaced the last one — the namespace CONNECT
   *  is owed again on its open packet. */
  resetConnection(): void;
}

export interface SocketIoSessionHooks {
  /** The engine.io open packet arrived with its ping cadence (ms);
   *  either absent when the server omitted it. */
  onHandshake?(cadence: { pingIntervalMs?: number; pingTimeoutMs?: number }): void;
  /** The server sent DISCONNECT for the session's namespace. */
  onServerDisconnect?(): void;
}

export function createSocketIoSessionController(
  namespace: string,
  sendFrame: (text: string) => void,
  connectAuthJson?: string,
  hooks: SocketIoSessionHooks = {},
): SocketIoSessionController {
  let ackId = 0;
  let connectSent = false;
  return {
    handleFrame(text) {
      const frame = parseEngineIoFrame(text);
      if (frame.kind === 'open') {
        // A duplicate open frame would be a server bug — the guard
        // keeps the CONNECT single either way.
        if (!connectSent) {
          connectSent = true;
          sendFrame(encodeConnectPacket(namespace, connectAuthJson));
        }
        hooks.onHandshake?.(handshakeCadence(frame.dataJson));
        return;
      }
      if (frame.kind === 'ping') {
        sendFrame(ENGINE_IO_PONG_FRAME);
        return;
      }
      if (
        frame.kind === 'packet' &&
        frame.packet.type === SOCKET_IO_PACKET_TYPES.disconnect &&
        frame.packet.namespace === namespace
      ) {
        hooks.onServerDisconnect?.();
      }
    },
    nextAckId() {
      ackId += 1;
      return ackId;
    },
    resetConnection() {
      connectSent = false;
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
