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

import type { ExecutedProxyRoute } from './request-execution';

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

/** The session's event log in packet order — PUBLISH messages both
 *  directions plus the subscription lifecycle facts, one array so the
 *  timeline renders every row at its true chronological position. */
export type ExecutedMqttEvent = ExecutedMqttMessage | ExecutedMqttSubscribed | ExecutedMqttUnsubscribed;

/** The CONNACK as the broker answered it — reason code verbatim (the
 *  5.0 space, or the separate 3.1.1 return-code space; the request's
 *  version knob scopes which), session-present flag surfaced. */
export interface ExecutedMqttConnack {
  sessionPresent: boolean;
  reasonCode: number;
}

/**
 * How the session ended once it was open: the clean client DISCONNECT
 * (the Disconnect button), a broker-initiated DISCONNECT with its
 * verbatim reason (`null` = the 3.1.1 wire, which carries none), or
 * `null` when the connection severed without a DISCONNECT packet —
 * that absence is recorded, never synthesized into a reason.
 */
export type ExecutedMqttEnd = { by: 'client' } | { by: 'broker'; reasonCode: number | null } | null;

export interface ExecutedMqttSnapshot {
  /** True when the broker accepted the CONNECT and the session opened;
   *  false = the connect failed pre-open (`error` names why — a CONNACK
   *  refusal carries its reason code verbatim in the message). */
  connected: boolean;
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
  /** How the open session ended (see {@link ExecutedMqttEnd}). */
  end: ExecutedMqttEnd;
  /** True when the user stopped the session via Stop-abort rather than
   *  a Disconnect — the capture holds what arrived. */
  stopped?: boolean;
  /** Whole-session wall time (connect start → settle), display-only. */
  durationMs: number;
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
  /** Non-null when the connect failed before the session opened —
   *  the host's classified, user-actionable message (a CONNACK refusal
   *  reason rides here verbatim). */
  error: string | null;
}
