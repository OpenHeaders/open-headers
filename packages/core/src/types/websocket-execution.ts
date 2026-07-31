/**
 * WebSocket session snapshot — the response shape the runtime returns
 * to UI surfaces when a WebSocketRequest session settles. Own shape
 * beside `ExecutedRequestSnapshot` / `ExecutedGrpcSnapshot` (own entity
 * kind, own executor plane — never a discriminant on either).
 *
 * Capture law: the snapshot records what the session DID, verbatim —
 * every message payload as it crossed the wire (text and binary frames
 * tagged apart, base64 in both cases so the capture is byte-honest),
 * the server's close code and reason exactly as received, `null` close
 * when the connection severed without a Close frame. Nothing here is
 * ever rewritten or synthesized; pretty/decoded views are display-side.
 */

import type { ExecutedProxyRoute } from './request-execution';

/** One captured message of the session, in call order. `direction`
 *  tags client-sent ('up') vs server-sent ('down'). Payloads ride
 *  base64 whether the frame was text or binary — `binary` records
 *  which frame type the wire carried, so a text view is a decode, not
 *  a guess. Timestamps are deliberately NOT here: message times are
 *  session-only display data (the SSE/gRPC precedent). */
export interface ExecutedWsMessage {
  direction: 'up' | 'down';
  dataBase64: string;
  binary: boolean;
}

/** The Close handshake as the wire answered it — code and reason
 *  verbatim, `wasClean` per the socket's own accounting. */
export interface ExecutedWsClose {
  code: number;
  reason: string;
  wasClean: boolean;
}

export interface ExecutedWsSnapshot {
  /** True when the handshake completed and the session opened; false =
   *  the connect failed pre-open (`error` names why). */
  connected: boolean;
  /** The subprotocol the server selected; empty when none negotiated. */
  protocol: string;
  /** The extensions the handshake negotiated; empty when none. The
   *  platform socket exposes no further handshake response headers —
   *  their absence here is recorded honesty, not omission. */
  extensions: string;
  /**
   * Captured messages in call order under the rolling retention cap:
   * the session stays open however chatty the server is, and the
   * capture keeps the most RECENT messages once the cap is hit —
   * `droppedMessages` counts what rolled off (honest truncation,
   * never silent).
   */
  messages: ExecutedWsMessage[];
  /** Messages that rolled off the retention window, 0 when none did. */
  droppedMessages: number;
  /** The Close frame as received (or locally initiated); `null` when
   *  the connection severed without one — never synthesized. */
  close: ExecutedWsClose | null;
  /** True when the user stopped the session via Stop-abort rather than
   *  a Disconnect close — the capture holds what arrived. */
  stopped?: boolean;
  /** Whole-session wall time (connect start → settle), display-only. */
  durationMs: number;
  /**
   * Wire truth for the session's proxy routing — the effective route
   * as the dial ran it. WS editors carry no request-plane proxy knobs
   * (the H5 ruling), so the plane is always `'system'` and the
   * stand-down analog is the Unix-socket pin only. Present only when
   * the system plane decided something; a plain direct session
   * carries no field. Browser runtimes never stamp it (the browser
   * owns proxying there).
   */
  proxyRoute?: ExecutedProxyRoute;
  /**
   * The remote host that ran this session on the caller's behalf —
   * a peer-forwarded dispatch answered by a connected back-end.
   * Stamped by the ANSWERING host; absent = the session ran on this
   * surface's own host (the gRPC snapshot's twin).
   */
  executedOn?: {
    kind: 'backend';
    name: string;
  };
  /** Non-null when the connect failed before the session opened —
   *  the host's classified, user-actionable message. */
  error: string | null;
}
