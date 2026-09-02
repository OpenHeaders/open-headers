/**
 * MQTT session snapshot — the response shape the runtime returns to UI
 * surfaces when an MqttRequest session settles. Own shape beside
 * `ExecutedRequestSnapshot` / `ExecutedGrpcSnapshot` /
 * `ExecutedWsSnapshot` (own entity kind, own executor plane — never a
 * discriminant on any of them).
 *
 * Capture law: the snapshot records what the session DID, verbatim —
 * every PUBLISH payload as it crossed the wire (base64, byte-honest;
 * text is a display-side decode), the QoS / RETAIN / DUP flags as
 * facts, SUBACK grants per subscription row (a broker downgrading the
 * QoS shows honestly), the CONNACK facts, and the broker DISCONNECT
 * reason exactly as received. Nothing here is ever rewritten or
 * synthesized; pretty/decoded views are display-side.
 */

import type { MqttScriptKind, ScriptExecutionMode } from '../scripts';
import type {
  ExecutedAuthAttribution,
  ExecutedProxyRoute,
  ExecutedScriptFold,
  ExecutedSessionScriptMark,
  ScriptEventSummary,
  TrustCertificateErrorHint,
} from './request-execution';

/** One captured PUBLISH of the session, in packet order. `direction`
 *  tags client-sent ('up') vs broker-sent ('down'). Payloads ride
 *  base64 — the wire carries bytes, so a text view is a decode, not a
 *  guess. Timestamps are deliberately NOT here: message times are
 *  session-only display data (the SSE/gRPC/WS precedent). */
export interface ExecutedMqttMessage {
  kind: 'message';
  direction: 'up' | 'down';
  topic: string;
  payloadBase64: string;
  qos: 0 | 1 | 2;
  /** The RETAIN flag as the wire carried it — on an inbound message
   *  this marks a retained delivery (a display tag, never a rewrite). */
  retain: boolean;
  dup: boolean;
}

/** One SUBACK grant, positional over the SUBSCRIBE's filters: the
 *  granted QoS (0–2) or the 5.0 failure code — verbatim either way. */
export interface ExecutedMqttGrant {
  topicFilter: string;
  reasonCode: number;
}

/** A SUBSCRIBE acknowledged — recorded at its position in the event
 *  log (the open-time subscription and every live toggle alike). */
export interface ExecutedMqttSubscribed {
  kind: 'subscribed';
  grants: ExecutedMqttGrant[];
}

/** An UNSUBSCRIBE acknowledged (a live Subscribe toggle turning off). */
export interface ExecutedMqttUnsubscribed {
  kind: 'unsubscribed';
  topicFilters: string[];
}

/**
 * How an open connection ended once it was open: the clean client
 * DISCONNECT (the Disconnect button), a broker-initiated DISCONNECT
 * with its verbatim reason (`null` = the 3.1.1 wire, which carries
 * none), or `null` when the connection severed without a DISCONNECT
 * packet — that absence is recorded, never synthesized into a reason.
 */
export type ExecutedMqttEnd = { by: 'client' } | { by: 'broker'; reasonCode: number | null } | null;

/** An OPEN connection dropped without the client asking and the
 *  session's auto-reconnect took over — `end` is how that connection
 *  ended (a broker DISCONNECT's reason verbatim, or the severed
 *  `null`). Never recorded for a client Disconnect. */
export interface ExecutedMqttLost {
  kind: 'lost';
  end: Exclude<ExecutedMqttEnd, { by: 'client' }>;
}

/** One reconnect attempt dialed (1-based). `delayMs` is the wait the
 *  attempt sat through (the period, or the backoff step). `error` is
 *  the PREVIOUS attempt's classified dial failure when there was one
 *  — the reason this attempt exists; absent on the first attempt
 *  after a drop. */
export interface ExecutedMqttReconnecting {
  kind: 'reconnecting';
  attempt: number;
  delayMs: number;
  error?: string;
  /** The user asked for the attempt before its wait ran out —
   *  `delayMs` is then the wait actually sat through. */
  forced?: true;
}

/** A reconnect attempt's CONNACK accepted — the new connection's
 *  facts verbatim (`sessionPresent` says whether the broker kept the
 *  session; when it did, the PUBLISHes still awaiting a QoS 1/2 ack
 *  go out again with DUP set — their rows follow; when it did not,
 *  the driver resubscribes and the SUBACK rows follow at their true
 *  positions). `dropped` = the unacknowledged PUBLISHes a fresh
 *  session could no longer ack — present only when there were any. */
export interface ExecutedMqttReconnected {
  kind: 'reconnected';
  attempt: number;
  sessionPresent: boolean;
  reasonCode: number;
  remainingLength: number;
  dropped?: number;
}

/**
 * One script hook ran — the per-event detail of the session's scripts
 * ({@link ExecutedSessionScriptMark}) under the MQTT hook kinds.
 * Recorded per event (a Before connect per dial, a Before publish per
 * rider publish, an On message per captured inbound PUBLISH, the After
 * close once) up to the mark cap; the snapshot's `scripts` record keeps
 * the tallies past it. It rides the event log like every other fact,
 * so the rolling retention applies to it too.
 */
export interface ExecutedMqttScriptMark extends ExecutedSessionScriptMark {
  kind: 'script';
  hook: MqttScriptKind;
}

/** The session's event log in packet order — PUBLISH messages both
 *  directions, the subscription lifecycle facts, the reconnect cycle
 *  facts (lost / reconnecting / reconnected) and the script marks, one
 *  array so the timeline renders every row at its true chronological
 *  position. */
export type ExecutedMqttEvent =
  | ExecutedMqttMessage
  | ExecutedMqttSubscribed
  | ExecutedMqttUnsubscribed
  | ExecutedMqttLost
  | ExecutedMqttReconnecting
  | ExecutedMqttReconnected
  | ExecutedMqttScriptMark;

/**
 * The session's scripts as they ran — one record per hook the session
 * carries scripts for: the once-per-session hooks keep their fold
 * (Before connect: the LAST dial's, with the dials counted; After
 * close: its one run), the per-event hooks keep a tally. Absent when
 * no hook ran. `mode` is the trust posture the hooks ran under,
 * recorded on the snapshot — never re-read from live settings.
 */
export interface ExecutedMqttScripts {
  mode?: ScriptExecutionMode;
  beforeConnect?: ExecutedScriptFold & { dials: number };
  beforePublish?: ScriptEventSummary & { dropped: number };
  onMessage?: ScriptEventSummary;
  afterClose?: ExecutedScriptFold;
  /** The per-event marks stopped at the cap — the tallies above kept
   *  counting; the timeline shows the first events' detail only. */
  marksCapped?: true;
}

/** The CONNACK as the broker answered it — reason code verbatim (the
 *  5.0 space, or the separate 3.1.1 return-code space; the request's
 *  version knob scopes which), session-present flag surfaced. */
export interface ExecutedMqttConnack {
  sessionPresent: boolean;
  reasonCode: number;
  /** The CONNACK frame's Remaining Length as framed on the wire — an
   *  observed byte count recorded at decode, never recomputed by
   *  re-encoding. Optional: captures saved before it was recorded
   *  carry no value (absence stays absence). */
  remainingLength?: number;
}

/**
 * How the session settled, first-class: `connected` = the broker
 * accepted the CONNECT and the session opened (however it later ended
 * — `end` and `stopped` carry that story); `failed` = a pre-open
 * failure with the host's classified, user-actionable message (a
 * CONNACK refusal reason rides here verbatim); `aborted` = the user
 * cancelled before the session opened — a neutral outcome carrying no
 * synthesized message.
 */
export type ExecutedMqttOutcome =
  | { kind: 'connected' }
  /** `hint` rides a TLS verification failure — the presented chain the
   *  pane can offer for pinning (the HTTP snapshot's hint). */
  | { kind: 'failed'; error: string; hint?: TrustCertificateErrorHint }
  | { kind: 'aborted' };

export interface ExecutedMqttSnapshot {
  /** How the session settled (see {@link ExecutedMqttOutcome}). */
  outcome: ExecutedMqttOutcome;
  /** The CONNACK facts; `null` when no CONNACK ever arrived. */
  connack: ExecutedMqttConnack | null;
  /** The client id the CONNECT actually carried — the entity's own, or
   *  the per-connect generated one when the field was blank. */
  clientId: string;
  /**
   * Captured events in packet order under the rolling retention cap:
   * the session stays open however chatty the broker is, and the
   * capture keeps the most RECENT events once the cap is hit —
   * `droppedMessages` counts what rolled off (honest truncation,
   * never silent).
   */
  events: ExecutedMqttEvent[];
  /** Events that rolled off the retention window, 0 when none did. */
  droppedMessages: number;
  /** How the open session ended (see {@link ExecutedMqttEnd}) — on a
   *  session that reconnected, how its LAST connection ended. On an
   *  ABORTED pre-open snapshot it is present only when a broker socket
   *  had actually been established — the torn-down connection is a
   *  real event the timeline logs. */
  end: ExecutedMqttEnd;
  /** True when the user stopped the OPEN session via Stop-abort rather
   *  than a Disconnect — the capture holds what arrived — or ended it
   *  with Disconnect while auto-reconnect was between attempts (no
   *  connection was up to DISCONNECT cleanly). Never set on a pre-open
   *  abort: the `aborted` outcome IS that mark. */
  stopped?: boolean;
  /** Auto-reconnect gave up: a reconnect attempt's CONNACK REFUSED the
   *  session (a refusal does not heal by redialing). The refusal reason
   *  verbatim, with the attempt it answered; the session settles with
   *  the LOST connection's end record. */
  reconnectRefused?: { attempt: number; error: string };
  /** Auto-reconnect gave up: the attempt cap was spent without a
   *  connection opening. `attempts` is how many were dialed; `error`
   *  the last attempt's classified failure when there was one. The
   *  session settles with the LOST connection's end record. */
  reconnectExhausted?: { attempts: number; error?: string };
  /** Whole-session wall time (connect start → settle), display-only. */
  durationMs: number;
  /** The auth the session applied and where it came from — the
   *  request's own or a resolved ancestor pool entry; absent when the
   *  request's own auth is `none` (the HTTP snapshot's twin). */
  auth?: ExecutedAuthAttribution;
  /** The session's script hooks as they ran — see {@link ExecutedMqttScripts};
   *  absent when no hook ran. */
  scripts?: ExecutedMqttScripts;
  /**
   * Wire truth for the session's proxy routing — present only when the
   * executing host's system plane decided something (the ws-scheme
   * dials ride the platform WebSocket stack, which consults it); a
   * plain direct session carries no field. Raw tcp-scheme dials are
   * always direct in v1.
   */
  proxyRoute?: ExecutedProxyRoute;
  /** The remote host that ran this session on the caller's behalf.
   *  Stamped by the ANSWERING host; absent = this surface's own host. */
  executedOn?: {
    kind: 'backend';
    name: string;
  };
}
