/**
 * Valibot schema for `MqttRequest` — the native MQTT session entity.
 *
 * Own entity kind beside the HTTP `Request`, `GrpcRequest` and
 * `WebSocketRequest` (the S8 scope law: session-shaped protocols get
 * their own editor and executor plane). One entity covers the whole
 * protocol — 3.1.1 vs 5.0 is the `protocolVersion` KNOB, never a wire
 * family the way Socket.IO was: the session anatomy (CONNECT,
 * SUBSCRIBE, PUBLISH, DISCONNECT) is identical and only the 5.0
 * property surfaces differ, so the editor renders those
 * disabled-honest on 3.1.1 instead of minting a sibling kind.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';
import { RequestTimeoutMsSchema } from './request';

/**
 * Session target: full `mqtt://` / `mqtts://` / `ws://` / `wss://` URL.
 * Kept a plain bounded string (templates welcome — `{{host}}` is the
 * expected idiom); the editor's scheme select keeps the input honest,
 * and reachability is a connect-time question. The scheme picks the
 * transport: tcp schemes dial `node:net`/`node:tls` on node hosts,
 * ws schemes ride MQTT-over-WebSocket on every host.
 */
export const MAX_MQTT_URL_LENGTH = 2_048;

export const MqttUrlSchema = v.pipe(v.string(), v.maxLength(MAX_MQTT_URL_LENGTH));

/**
 * Protocol-version knob. Absent = `5.0` (first-class default); `3.1.1`
 * targets the brokers that still refuse 5. The session driver maps the
 * knob to the wire level (`MQTT_PROTOCOL_VERSIONS` in `core/mqtt`);
 * the codec is encode-strict, so a 3.1.1 session never silently drops
 * 5.0 content — the editor keeps those surfaces disabled-honest.
 */
export const MqttProtocolVersionSchema = v.picklist(['5.0', '3.1.1']);

/** Quality-of-service level, both directions. Absent on a row = 0. */
export const MqttQosSchema = v.picklist([0, 1, 2]);

/**
 * Compose ENCODING for a payload draft: `text`/`json` compose the
 * typed characters verbatim (JSON gets the structured editor), while
 * `base64`/`hex` compose the DECODED bytes — a binary payload authored
 * as its encoding. Unlike the WebSocket display-only format toggle,
 * this changes what goes on the wire; invalid base64/hex input gates
 * Send honestly. Absent = `text`.
 */
export const MqttPayloadFormatSchema = v.picklist(['text', 'json', 'base64', 'hex']);

/**
 * One user-property row — the shared row anatomy for the CONNECT-level
 * `userProperties` set path AND the nested per-message / will property
 * blocks. `uid` is the stable per-row identity the sync engine's
 * set-modeled paths key by (nested blocks keep it for row identity in
 * the grids even though they ride the per-leaf flatten-diff).
 */
export const MqttUserPropertyRowSchema = v.object({
  uid: UidSchema,
  key: v.string(),
  value: v.string(),
  /** Optional free-form per-row note rendered in the Description column. */
  description: v.optional(v.string()),
  enabled: v.optional(v.boolean()),
});

/**
 * Per-message 5.0 property block — the "⋯" popover on the publish
 * compose, a saved message, and the last will. Values persist verbatim
 * as authored (templates welcome); the session driver encodes them
 * into the ratified 5.0 property subset at send. Intervals are SECONDS
 * — the 5.0 wire unit, surfaced honestly instead of a converted
 * millisecond field.
 */
export const MqttMessagePropertiesSchema = v.object({
  userProperties: v.optional(v.array(MqttUserPropertyRowSchema)),
  responseTopic: v.optional(v.string()),
  /** Correlation data authored as text; travels as its UTF-8 bytes. */
  correlationData: v.optional(v.string()),
  /** Message Expiry Interval, seconds (four-byte wire range). */
  messageExpiryInterval: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffff_ffff))),
  contentType: v.optional(v.string()),
  /** Payload Format Indicator — true marks the payload UTF-8 text. */
  payloadFormatIndicator: v.optional(v.boolean()),
});

/** 5.0 Retain Handling subscription option (spec values 0/1/2). */
export const MqttRetainHandlingSchema = v.picklist([0, 1, 2]);

/**
 * One Topics-tab subscription row. The stored table is the DRAFT the
 * session subscribes from at open — live Subscribe toggles ride
 * session riders and mark the row, never edit the entity (the
 * publication-gate idiom, ratified fork 1). Wildcards `+`/`#` are
 * legal; `topicFilterError` from `core/mqtt` validates inline. The
 * 5.0 subscription options live in the per-row "⋯" popover — 3.1.1
 * renders them disabled-honest.
 */
export const MqttTopicRowSchema = v.object({
  uid: UidSchema,
  topicFilter: v.string(),
  /** Requested QoS for the subscription. Absent = 0. */
  qos: v.optional(MqttQosSchema),
  /** Subscribe this row when the session opens. Absent = on. */
  subscribe: v.optional(v.boolean()),
  /** Optional free-form per-row note rendered in the Description column. */
  description: v.optional(v.string()),
  /** 5.0: don't echo this client's own publishes back (No Local). */
  noLocal: v.optional(v.boolean()),
  /** 5.0: forward the publish RETAIN flag as published. */
  retainAsPublished: v.optional(v.boolean()),
  /** 5.0: retained-message send policy on subscribe (0/1/2). */
  retainHandling: v.optional(MqttRetainHandlingSchema),
  /** 5.0 Subscription Identifier (varint range, min 1). */
  subscriptionId: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(268_435_455))),
  /**
   * 5.0 User Properties carried ONCE on this row's SUBSCRIBE packet —
   * metadata to the broker at subscribe time (the spec leaves their
   * meaning to the broker); never echoed on delivered messages.
   */
  userProperties: v.optional(v.array(MqttUserPropertyRowSchema)),
});

/**
 * One Saved-messages rail row — a reusable publish preset. SYNCED
 * entity rows (unlike the reference client's local rail state): they
 * travel with the workspace, git-sync, and multi-window. Clicking one
 * loads the compose; Send-from-row lands with the session plane.
 */
export const MqttSavedMessageSchema = v.object({
  uid: UidSchema,
  name: v.string(),
  topic: v.string(),
  payload: v.string(),
  /** Payload encoding. Absent = `text`. */
  format: v.optional(MqttPayloadFormatSchema),
  qos: v.optional(MqttQosSchema),
  retain: v.optional(v.boolean()),
  properties: v.optional(MqttMessagePropertiesSchema),
});

/**
 * Last-will block — registered on CONNECT, published by the broker on
 * an ungraceful disconnect. Absent = no will. `willDelayInterval` is
 * SECONDS (the 5.0 wire unit); the will properties ride the same
 * per-message block as the publish compose.
 */
export const MqttLastWillSchema = v.object({
  topic: v.string(),
  payload: v.string(),
  /** Payload encoding. Absent = `text`. */
  format: v.optional(MqttPayloadFormatSchema),
  qos: v.optional(MqttQosSchema),
  retain: v.optional(v.boolean()),
  /** 5.0 Will Delay Interval, seconds. */
  willDelayInterval: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffff_ffff))),
  properties: v.optional(MqttMessagePropertiesSchema),
});

/**
 * Session credential — MQTT-native Basic auth: the username/password
 * pair the CONNECT packet carries (both protocol versions speak it;
 * the reference client's exact scope). Templates welcome — the
 * executor resolves both fields at Connect, an empty resolved field
 * reads as absent (partial configs stay saveable — the WS bearer
 * posture), and the capture never carries the credential (the
 * volatile/secret law). Absent = `none`. 5.0 enhanced AUTH is
 * demand-gated.
 */
export const MqttAuthSchema = v.variant('type', [
  v.object({ type: v.literal('none') }),
  v.object({
    type: v.literal('basic'),
    /** CONNECT User Name; templates resolve at Connect. */
    username: v.string(),
    /** CONNECT Password, authored as text (travels as its UTF-8 bytes). */
    password: v.string(),
  }),
]);

/**
 * Binding to the AsyncAPI spec that feeds compose aids — ids-only
 * identity, same posture as `WebSocketSpecLinkSchema`: the census is
 * rebuilt from the spec's live files at consume, nothing cached.
 */
export const MqttSpecLinkSchema = v.object({
  specUid: UidSchema,
});

export const MqttRequestSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  name: v.string(),
  /** Free-form Markdown notes (Docs-tab parity with the HTTP request). */
  description: v.optional(v.string()),
  url: MqttUrlSchema,
  /** Protocol-version knob. Absent = `5.0`. */
  protocolVersion: v.optional(MqttProtocolVersionSchema),
  /** Publish compose: the topic the next Publish targets. Templates welcome. */
  topic: v.string(),
  /**
   * Publish compose draft. Fans out to the payload sibling file on
   * disk (the `message.json` precedent); the manifest never carries
   * it. Empty string = nothing composed yet.
   */
  payload: v.string(),
  /** Publish compose payload encoding. Absent = `text`. */
  payloadFormat: v.optional(MqttPayloadFormatSchema),
  /** Publish compose QoS. Absent = 0. */
  qos: v.optional(MqttQosSchema),
  /** Publish compose RETAIN flag. Absent = off. */
  retain: v.optional(v.boolean()),
  /** Publish compose 5.0 per-message properties ("⋯" popover). */
  publishProperties: v.optional(MqttMessagePropertiesSchema),
  /** Topics-tab subscription rows (set-modeled — the stored draft). */
  topics: v.array(MqttTopicRowSchema),
  /** Saved-messages rail rows (set-modeled). */
  savedMessages: v.array(MqttSavedMessageSchema),
  /** CONNECT-level user properties (set-modeled; 5.0, the Properties tab). */
  userProperties: v.array(MqttUserPropertyRowSchema),
  /** Session credential on the CONNECT packet. Absent = none. */
  auth: v.optional(MqttAuthSchema),
  lastWill: v.optional(MqttLastWillSchema),
  specLink: v.optional(MqttSpecLinkSchema),
  /**
   * Client identifier the CONNECT carries. Blank/absent = generated
   * per connect (session resumption needs a stable id — the Settings
   * help copy names that interaction). Templates welcome.
   */
  clientId: v.optional(v.string()),
  /** Clean Start flag on CONNECT. Absent = on (the safe default). */
  cleanStart: v.optional(v.boolean()),
  /** 5.0 Session Expiry Interval, seconds. Ignored under clean start
   *  unless a later session resumes — the help copy carries that. */
  sessionExpiryInterval: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffff_ffff))),
  /** Keep Alive, seconds — the driver answers/emits PINGREQ. Absent = 60. */
  keepAlive: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(65_535))),
  /** 5.0 Receive Maximum — inbound QoS>0 flow-control window. */
  receiveMaximum: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65_535))),
  /** 5.0 Maximum Packet Size this client accepts, bytes. */
  maximumPacketSize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(0xffff_ffff))),
  /** 5.0 Topic Alias Maximum — how many topic aliases the broker may
   *  address this client with. Absent = 0 (the broker sends none). */
  topicAliasMaximum: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(65_535))),
  /** 5.0 Request Response Information — asks the broker for Response
   *  Information on CONNACK (the request/response pattern's base
   *  topic). Absent = off (the spec default). */
  requestResponseInformation: v.optional(v.boolean()),
  /** 5.0 Request Problem Information — allows Reason Strings and user
   *  properties on failure packets. Absent = on (the spec default). */
  requestProblemInformation: v.optional(v.boolean()),
  /**
   * Wall-clock ceiling (ms) on the connection dial — the transport's
   * open deadline only; an OPEN session has no ceiling. Absent = the
   * runtime's 30 s reference default. Same bounds as the HTTP
   * request's timeout knob.
   */
  timeoutMs: v.optional(RequestTimeoutMsSchema),
  /**
   * Verify the server certificate against the system roots
   * (mqtts/wss). Absent = verify (the safe default); `false` accepts
   * self-signed development brokers.
   */
  sslVerification: v.optional(v.boolean()),
});

/**
 * Content-only shape (no `schemaVersion` / `uid` / `path`) — the
 * pre-fill handoff unit, mirroring `WebSocketRequestSeedSchema`.
 */
export const MqttRequestSeedSchema = v.omit(MqttRequestSchema, ['schemaVersion', 'uid', 'path']);
