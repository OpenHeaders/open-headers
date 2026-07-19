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
 * Every write goes through the executor's `sendFrame` closure, so the
 * protocol frames are captured and broadcast VERBATIM like any other
 * ↑ message (the capture law — display decodes them into subdued
 * control rows). Ack ids are minted here so EVENT composes correlate
 * their ACK replies; the grammar itself lives in
 * `@openheaders/core/socketio` — one module shared with the display
 * decode.
 */

import { ENGINE_IO_PONG_FRAME, encodeConnectPacket, parseEngineIoFrame } from '@openheaders/core/socketio';

export interface SocketIoSessionController {
  /** Feed one inbound TEXT frame — answers protocol obligations
   *  (open → namespace CONNECT, ping → pong) through `sendFrame`. */
  handleFrame(text: string): void;
  /** Mint the next ack correlation id for an EVENT compose. */
  nextAckId(): number;
}

export function createSocketIoSessionController(
  namespace: string,
  sendFrame: (text: string) => void,
  connectAuthJson?: string,
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
        return;
      }
      if (frame.kind === 'ping') sendFrame(ENGINE_IO_PONG_FRAME);
    },
    nextAckId() {
      ackId += 1;
      return ackId;
    },
  };
}
