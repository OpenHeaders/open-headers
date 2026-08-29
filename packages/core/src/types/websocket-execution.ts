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

import type { ExecutedProxyRoute, TrustCertificateErrorHint } from './request-execution';

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

/**
 * An OPEN connection dropped without the client asking and the
 * session's auto-reconnect took over — `close` is the Close frame
 * that ended it verbatim, or `null` when it severed without one;
 * `idle` marks the liveness deadline closing it (no frame for
 * `idleTimeoutMs`). Never recorded for a client Disconnect.
 */
export interface ExecutedWsLost {
  kind: 'lost';
  close: ExecutedWsClose | null;
  idle?: true;
}

/** One reconnect attempt dialed (1-based) after `delayMs` of waiting
 *  (the period, or the backoff step). `error` is the PREVIOUS
 *  attempt's classified dial failure when there was one; `forced` =
 *  the user cut the wait short (`delayMs` is then the wait actually
 *  sat through). */
export interface ExecutedWsReconnecting {
  kind: 'reconnecting';
  attempt: number;
  delayMs: number;
  error?: string;
  forced?: true;
}

/** A reconnect attempt's handshake settled — the new connection's
 *  negotiated facts verbatim. */
export interface ExecutedWsReconnected {
  kind: 'reconnected';
  attempt: number;
  protocol: string;
  extensions: string;
}

/**
 * One reconnect-cycle fact of the session. `atIndex` is the number of
 * captured messages when it happened, so the timeline renders the row
 * at its true chronological position while `messages` and its
 * positional session timing stay untouched (the message rows' identity
 * discipline); the rolling retention offsets it by `droppedMessages`.
 */
export type ExecutedWsLifecycle = (ExecutedWsLost | ExecutedWsReconnecting | ExecutedWsReconnected) & {
  atIndex: number;
};

/**
 * How the session settled, first-class: `connected` = the handshake
 * completed and the session opened (however it later ended — `close`
 * and `stopped` carry that story); `failed` = a pre-open failure with
 * the host's classified, user-actionable message; `aborted` = the
 * user cancelled before the session opened — a neutral outcome
 * carrying no synthesized message.
 */
export type ExecutedWsOutcome =
  | { kind: 'connected' }
  | {
      kind: 'failed';
      error: string;
      /** The remedy a node runtime attaches to a certificate-verification
       *  failure — the endpoint to probe for the presented chain and the
       *  trust gesture (the HTTP snapshot's `trust-certificate` hint). */
      hint?: TrustCertificateErrorHint;
    }
  | { kind: 'aborted' };

export interface ExecutedWsSnapshot {
  /** How the session settled (see {@link ExecutedWsOutcome}). */
  outcome: ExecutedWsOutcome;
  /** The URL the session dialed, templates resolved. Absent on
   *  snapshots that predate the stamp. */
  url?: string;
  /** The handshake request headers the executor composed — user rows,
   *  the bearer credential, the subprotocol offer; the platform socket
   *  adds its own on top. Absent on snapshots that predate the stamp. */
  requestHeaders?: Array<{ key: string; value: string }>;
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
  /** The reconnect-cycle facts (lost / reconnecting / reconnected) in
   *  order — see {@link ExecutedWsLifecycle}. Absent = the session
   *  never reconnected. */
  lifecycle?: ExecutedWsLifecycle[];
  /** Auto-reconnect gave up: the attempt cap was spent without a
   *  connection opening. `attempts` is how many were dialed; `error`
   *  the last attempt's classified failure when there was one. The
   *  session settles with the LOST connection's close record. */
  reconnectExhausted?: { attempts: number; error?: string };
  /** True when the user stopped the OPEN session via Stop-abort rather
   *  than a Disconnect close — the capture holds what arrived. Never
   *  set on a pre-open abort: the `aborted` outcome IS that mark. */
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
}
