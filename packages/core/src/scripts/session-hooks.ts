/**
 * Session script hooks — what a live session's hook sees and what it
 * may hand back, per kind. A session execution
 * (`SessionScriptExecution` in `./index`) carries ONE of these inputs;
 * the runner builds the hook's `oh.*` surface from it and folds the
 * script's edits into ONE `SessionScriptMutation` (the HTTP mutation's
 * law: a complete diff replaces the pending one, all-empty normalizes
 * to none).
 *
 * The WebSocket family — Before connect at every dial (mutate url /
 * headers / params / subprotocols), Before send per rider send (mutate
 * or drop), On message per captured inbound frame (observe, reply
 * through `oh.send`, assert), After close once at settle (assert). The
 * MQTT family is its twin on the CONNECT / PUBLISH plane — Before
 * connect at every dial (mutate client id / credentials / will /
 * subscriptions / user properties), Before publish per rider publish
 * (mutate topic / payload / QoS / retain / properties, or drop), On
 * message per captured inbound PUBLISH (observe, reply through
 * `oh.publish`, assert), After close once at settle. gRPC joins with
 * its own.
 */

import type { MqttScriptKind, WsScriptKind } from './slots';

export interface SessionHeader {
  key: string;
  value: string;
}

export interface SessionParam {
  key: string;
  value: string;
}

// ── WebSocket ─────────────────────────────────────────────────────

/**
 * Before connect — the dial as the executor composed it: the user's
 * rows template-resolved and the query params already on the URL, the
 * session credential NOT yet minted (it mints onto what the hook
 * leaves, so a signer covers the mutated URL). `params` is the URL's
 * query parsed back out (the HTTP snapshot's law) — a `params`
 * mutation rewrites the query string wholesale.
 */
export interface WsConnectSnapshot {
  url: string;
  headers: SessionHeader[];
  params: SessionParam[];
  subprotocols: string[];
  /** `0` for the first dial, `n` for the n-th auto-reconnect attempt. */
  attempt: number;
}

/** The connect diff — absent keys mean "no change"; lists replace. */
export interface WsConnectMutation {
  url?: string;
  headers?: SessionHeader[];
  params?: SessionParam[];
  subprotocols?: string[];
}

/**
 * Before send — the rider's message after template resolution, before
 * the frame is composed: the compose text (a socketio event's JSON
 * arguments array; a binary compose's base64 bytes), the frame type,
 * and the socketio addendum when the session speaks it. `index` is the
 * capture position the message takes if it goes out.
 */
export interface WsOutboundMessageSnapshot {
  direction: 'up';
  text: string;
  binary: boolean;
  eventName?: string;
  expectAck?: boolean;
  index: number;
}

/** The send diff — `drop` ends the send with nothing on the wire. */
export interface WsSendMutation {
  text?: string;
  eventName?: string;
  drop?: true;
}

/**
 * On message — one captured INBOUND frame, after the capture: the text
 * decode of a text frame (`null` for a binary one), the bytes as the
 * capture holds them, and the capture index the frame took.
 */
export interface WsInboundMessageSnapshot {
  direction: 'down';
  text: string | null;
  dataBase64: string;
  binary: boolean;
  index: number;
}

/**
 * After close — the session's end record, once at settle for a session
 * that opened: the Close frame verbatim (`code` `null` when the
 * connection severed without one), whether the user stopped it, the
 * capture counts and the whole-session wall time.
 */
export interface WsCloseSnapshot {
  code: number | null;
  reason: string;
  wasClean: boolean;
  stopped: boolean;
  messages: number;
  droppedMessages: number;
  durationMs: number;
}

/** One WebSocket hook's input, discriminated on the slot kind. */
export type WsHookInput =
  | { kind: 'ws-before-connect'; connect: WsConnectSnapshot }
  | { kind: 'ws-before-send'; message: WsOutboundMessageSnapshot }
  | { kind: 'ws-on-message'; message: WsInboundMessageSnapshot }
  | { kind: 'ws-after-close'; close: WsCloseSnapshot };

// ── MQTT ──────────────────────────────────────────────────────────

export type MqttSessionQos = 0 | 1 | 2;

/** The compose spellings a script reads and writes: UTF-8 text (JSON
 *  is text the editor highlights) or the bytes as base64 — a hex
 *  compose re-spells as base64 before the hook, one byte spelling. */
export type MqttScriptPayloadFormat = 'text' | 'json' | 'base64';

/**
 * The 5.0 per-message properties as a script reads and writes them —
 * the entity's block without row identities, strings resolved:
 * `correlationData` is text (it travels as its UTF-8 bytes). Ignored
 * on a 3.1.1 session (the driver's disabled-honest lens).
 */
export interface MqttScriptMessageProperties {
  userProperties?: SessionHeader[];
  responseTopic?: string;
  correlationData?: string;
  messageExpiryInterval?: number;
  contentType?: string;
  payloadFormatIndicator?: boolean;
}

/** The last will as the CONNECT registers it — the payload as bytes
 *  (base64), the QoS and RETAIN flags. `null` = no will. */
export interface MqttConnectWill {
  topic: string;
  payloadBase64: string;
  qos: MqttSessionQos;
  retain: boolean;
}

/** One open-time subscription — the Topics row's filter and options as
 *  the executor resolved them (the 5.0 options ride 5.0 sessions only). */
export interface MqttConnectSubscription {
  topicFilter: string;
  qos: MqttSessionQos;
  noLocal?: boolean;
  retainAsPublished?: boolean;
  retainHandling?: 0 | 1 | 2;
  subscriptionId?: number;
  userProperties?: SessionHeader[];
}

/**
 * Before connect — the CONNECT as the executor composed it, before
 * the packet leaves: the client id (the entity's, or the per-connect
 * generated one), the Basic credential's pair (`''` = none), the will,
 * the enabled Topics rows that SUBSCRIBE at open, the CONNECT user
 * properties (5.0). `url` and `protocolVersion` are the dial's facts,
 * read-only. Every field resolves its templates before the hook.
 */
export interface MqttConnectSnapshot {
  url: string;
  protocolVersion: '5.0' | '3.1.1';
  clientId: string;
  username: string;
  password: string;
  will: MqttConnectWill | null;
  subscriptions: MqttConnectSubscription[];
  userProperties: SessionHeader[];
  /** `0` for the first dial, `n` for the n-th auto-reconnect attempt. */
  attempt: number;
}

/** The connect diff — absent keys mean "no change"; `will: null` drops
 *  the will; lists replace. */
export interface MqttConnectMutation {
  clientId?: string;
  username?: string;
  password?: string;
  will?: MqttConnectWill | null;
  subscriptions?: MqttConnectSubscription[];
  userProperties?: SessionHeader[];
}

/**
 * Before publish — the rider's compose after template resolution,
 * before the PUBLISH is composed: the topic, the payload in the
 * script spelling (`format` says which), the flags, the 5.0 properties
 * when the compose carries any. `index` is the event-log position the
 * message takes if it goes out.
 */
export interface MqttOutboundMessageSnapshot {
  direction: 'up';
  topic: string;
  payload: string;
  format: MqttScriptPayloadFormat;
  qos: MqttSessionQos;
  retain: boolean;
  properties?: MqttScriptMessageProperties;
  index: number;
}

/** The publish diff — `drop` ends the publish with nothing on the wire. */
export interface MqttPublishMutation {
  topic?: string;
  payload?: string;
  format?: MqttScriptPayloadFormat;
  qos?: MqttSessionQos;
  retain?: boolean;
  properties?: MqttScriptMessageProperties;
  drop?: true;
}

/**
 * On message — one captured INBOUND PUBLISH, after the capture: the
 * topic (an alias resolved), the payload bytes as the capture holds
 * them and their UTF-8 decode (`null` when the bytes are not text),
 * the flags as facts, the 5.0 properties the packet carried, and the
 * event-log index the message took.
 */
export interface MqttInboundMessageSnapshot {
  direction: 'down';
  topic: string;
  payloadBase64: string;
  text: string | null;
  qos: MqttSessionQos;
  retain: boolean;
  dup: boolean;
  properties?: MqttScriptMessageProperties;
  index: number;
}

/**
 * After close — the session's end record, once at settle for a session
 * that opened: how the (last) connection ended (the clean client
 * DISCONNECT, the broker's DISCONNECT with its verbatim reason, `null`
 * for a severed connection), the CONNACK facts, whether the user
 * stopped it, the capture counts both directions and the whole-session
 * wall time.
 */
export interface MqttCloseSnapshot {
  end: { by: 'client' } | { by: 'broker'; reasonCode: number | null } | null;
  connack: { sessionPresent: boolean; reasonCode: number } | null;
  stopped: boolean;
  published: number;
  received: number;
  droppedMessages: number;
  durationMs: number;
}

/** One MQTT hook's input, discriminated on the slot kind. */
export type MqttHookInput =
  | { kind: 'mqtt-before-connect'; connect: MqttConnectSnapshot }
  | { kind: 'mqtt-before-publish'; message: MqttOutboundMessageSnapshot }
  | { kind: 'mqtt-on-message'; message: MqttInboundMessageSnapshot }
  | { kind: 'mqtt-after-close'; close: MqttCloseSnapshot };

// ── The union ─────────────────────────────────────────────────────

/** Every session family's hook input — WebSocket and MQTT today. */
export type SessionHookInput = WsHookInput | MqttHookInput;

/** The kinds whose hook may hand a mutation back. */
export type MutatingWsScriptKind = Extract<WsScriptKind, 'ws-before-connect' | 'ws-before-send'>;
export type MutatingMqttScriptKind = Extract<MqttScriptKind, 'mqtt-before-connect' | 'mqtt-before-publish'>;

/**
 * The one mutation a session hook folds to — the family's diff under
 * its tag, so the executor applying it never guesses which hook ran.
 */
export type SessionScriptMutation =
  | ({ kind: 'ws-connect' } & WsConnectMutation)
  | ({ kind: 'ws-send' } & WsSendMutation)
  | ({ kind: 'mqtt-connect' } & MqttConnectMutation)
  | ({ kind: 'mqtt-publish' } & MqttPublishMutation);

/**
 * What `oh.publish` hands the host — the `session.publish` op's
 * message: the compose as the rider carries it, the properties in the
 * script shape (the host maps them onto the rider's rows).
 */
export interface SessionPublishMessage {
  topic: string;
  payload: string;
  format?: MqttScriptPayloadFormat;
  qos?: MqttSessionQos;
  retain?: boolean;
  properties?: MqttScriptMessageProperties;
}
