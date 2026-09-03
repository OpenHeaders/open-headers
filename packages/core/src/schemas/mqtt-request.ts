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
import { PathSegmentSchema, RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';
import {
  ClientCertificateRefSchema,
  ProxyCredentialRefSchema,
  ProxyModeSchema,
  ProxyUrlSchema,
  proxyPairChecks,
  ReconnectMaxAttemptsSchema,
  RequestTimeoutMsSchema,
  ResolveToAddressSchema,
  SniServerNameSchema,
  TlsCipherSuitesSchema,
  TlsVersionSchema,
} from './request';
import { MqttScriptSlotsSchema } from './script-slots';
import { MQTT_AUTH_TYPES, requestAuthSchemaFor } from './session-auth';

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
 * Session credential — the request's OWN auth under the MQTT mask
 * (`MQTT_AUTH_TYPES`: Basic alone — the username/password pair the
 * CONNECT packet carries, which both protocol versions speak; the
 * reference client's exact scope), or `inherit`, resolving through
 * the ancestor pool (`@openheaders/core/auth-inheritance`) under the
 * same mask. Templates welcome — the executor resolves both fields at
 * Connect, an empty resolved field reads as absent (partial configs
 * stay saveable — the WS bearer posture), and the capture never
 * carries the credential (the volatile/secret law). Absent = `none`.
 * 5.0 enhanced AUTH is demand-gated.
 */
export const MqttAuthSchema = requestAuthSchemaFor(MQTT_AUTH_TYPES);

/**
 * Binding to the AsyncAPI spec that feeds compose aids — ids-only
 * identity, same posture as `WebSocketSpecLinkSchema`: the census is
 * rebuilt from the spec's live files at consume, nothing cached.
 */
export const MqttSpecLinkSchema = v.object({
  specUid: UidSchema,
});

export const MAX_ALPN_PROTOCOL_LENGTH = 255;

/**
 * The CONNECT-level numeric knobs, named so the request schema and the
 * container settings schema (`inheritable-settings.ts`) validate the
 * same bounds: seconds on the wire for the intervals, counts for the
 * windows, bytes for the packet cap.
 */
export const MqttSessionExpiryIntervalSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffff_ffff));
export const MqttKeepAliveSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(65_535));
export const MqttReceiveMaximumSchema = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65_535));
export const MqttMaximumPacketSizeSchema = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(0xffff_ffff));
export const MqttTopicAliasMaximumSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(65_535));
export const MqttAlpnProtocolSchema = v.pipe(v.string(), v.maxLength(MAX_ALPN_PROTOCOL_LENGTH));

const MqttRequestObjectSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  pathSegment: v.optional(PathSegmentSchema),
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
   * The request's own session scripts — the MQTT kinds
   * (`@openheaders/core/scripts` — `MQTT_SCRIPT_KINDS`: before connect,
   * before publish, on message, after close), composed after the
   * ancestor levels' slots of the same kind. Each key fans out to its
   * `<kind>.js` sibling beside `mqtt.yaml`; the manifest never carries
   * source. Absent key ↔ no script.
   */
  scripts: v.optional(MqttScriptSlotsSchema),
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
  sessionExpiryInterval: v.optional(MqttSessionExpiryIntervalSchema),
  /** Keep Alive, seconds — the driver answers/emits PINGREQ. Absent = 60. */
  keepAlive: v.optional(MqttKeepAliveSchema),
  /** 5.0 Receive Maximum — inbound QoS>0 flow-control window. */
  receiveMaximum: v.optional(MqttReceiveMaximumSchema),
  /** 5.0 Maximum Packet Size this client accepts, bytes. */
  maximumPacketSize: v.optional(MqttMaximumPacketSizeSchema),
  /** 5.0 Topic Alias Maximum — how many topic aliases the broker may
   *  address this client with. Absent = 0 (the broker sends none). */
  topicAliasMaximum: v.optional(MqttTopicAliasMaximumSchema),
  /** 5.0 Request Response Information — asks the broker for Response
   *  Information on CONNACK (the request/response pattern's base
   *  topic). Absent = off (the spec default). */
  requestResponseInformation: v.optional(v.boolean()),
  /** 5.0 Request Problem Information — allows Reason Strings and user
   *  properties on failure packets. Absent = on (the spec default). */
  requestProblemInformation: v.optional(v.boolean()),
  /**
   * Resolve the URL's host to this IPv4 / IPv6 address at connect time
   * instead of asking DNS — the HTTP request's knob on the broker dial: SNI,
   * the `mqtts:` server name and certificate verification keep the ORIGINAL hostname;
   * only where the socket goes changes. Node runtimes only.
   * Pattern-validated — see {@link ResolveToAddressSchema}.
   */
  resolveToAddress: v.optional(ResolveToAddressSchema),
  /**
   * Proxy routing mode for the dial — the HTTP request's knob. Absent =
   * INHERIT the executing host's system plane; `'direct'` opts the
   * session out of any ambient proxy; `'url'` routes through `proxyUrl`.
   * The mode / URL pair is tied by the checks on the persisted schema.
   */
  proxyMode: v.optional(ProxyModeSchema),
  /**
   * Route the dial through this proxy instead of connecting directly —
   * an HTTP CONNECT tunnel on every scheme, or the SOCKS5 dial on `ws(s):` (a raw `mqtt(s):` dial tunnels CONNECT only, so a SOCKS5 URL fails before the wire) — so end-to-end TLS still verifies the TARGET.
   * Incompatible with `resolveToAddress` (the dial fails
   * naming the conflict). Credentials never ride this URL — see
   * `proxyCredentialRef`. Node runtimes only.
   */
  proxyUrl: v.optional(ProxyUrlSchema),
  /**
   * Vault string entry NAME holding the proxy's `user:password` — sent
   * on the proxy leg only, never to the target. Only meaningful
   * alongside `proxyUrl`; a ref that doesn't resolve on this device
   * fails the dial naming this setting. Node runtimes only.
   */
  proxyCredentialRef: v.optional(ProxyCredentialRefSchema),
  /**
   * Wall-clock ceiling (ms) on the connection dial — the transport's
   * open deadline only; an OPEN session has no ceiling. Absent = the
   * runtime's 30 s reference default. Same bounds as the HTTP
   * request's timeout knob.
   */
  timeoutMs: v.optional(RequestTimeoutMsSchema),
  /**
   * Reopen the session after an OPEN connection drops without the
   * client asking (severed socket, broker DISCONNECT) — redial on the
   * reconnect period until it opens again or the user disconnects.
   * Absent = off: nothing reconnects silently. A first connect that
   * fails never retries.
   */
  autoReconnect: v.optional(v.boolean()),
  /**
   * Wait (ms) between reconnect attempts. Absent = the runtime's 5 s
   * reference default. Same bounds as the connect timeout knob.
   */
  reconnectPeriodMs: v.optional(RequestTimeoutMsSchema),
  /**
   * Cap on consecutive reconnect attempts after one drop — a successful
   * reconnect resets the count. Absent = unlimited: the loop runs until
   * the broker is back or the user disconnects. When the cap is spent
   * the session settles as Reconnect gave up.
   */
  reconnectMaxAttempts: v.optional(ReconnectMaxAttemptsSchema),
  /**
   * Double the wait after every failed attempt (period, 2×, 4× …)
   * up to the runtime's 60 s ceiling, with ±20 % jitter so clients
   * never redial in lockstep. Absent = ON (what the production SDKs
   * do); `false` = every attempt waits the exact reconnect period.
   */
  reconnectBackoff: v.optional(v.boolean()),
  /**
   * Verify the server certificate against the system roots
   * (mqtts/wss). Absent = verify (the safe default); `false` accepts
   * self-signed development brokers.
   */
  sslVerification: v.optional(v.boolean()),
  /**
   * Vault `client-certificate` entry NAME presented in the TLS
   * handshake (mqtts/wss) — mutual-TLS brokers. The PEM pair never
   * rides the request; the executor resolves the ref at connect (the
   * HTTP request's contract). Node runtimes only.
   */
  clientCertificateRef: v.optional(ClientCertificateRefSchema),
  /** Lowest TLS version the dial may negotiate — the HTTP request's
   *  knob. Absent = the runtime floor (1.2); `1.0` / `1.1` lower it
   *  for legacy brokers. Node runtimes only. */
  tlsMinVersion: v.optional(TlsVersionSchema),
  /** Highest TLS version the dial may negotiate. Absent = the runtime
   *  ceiling (1.3). Node runtimes only. */
  tlsMaxVersion: v.optional(TlsVersionSchema),
  /** Cipher suites offered on the dial, OpenSSL colon-list. Absent =
   *  the runtime's defaults. Node runtimes only. */
  tlsCipherSuites: v.optional(TlsCipherSuitesSchema),
  /**
   * SNI server name override for `mqtts:` dials. Absent = the URL's
   * host. Templates welcome. Node runtimes only.
   */
  sniServerName: v.optional(SniServerNameSchema),
  /**
   * ALPN protocol offered on `mqtts:` dials — brokers multiplexing
   * MQTT on a shared TLS port select on it. Absent = no ALPN offer.
   * Templates welcome. Node runtimes only.
   */
  alpnProtocol: v.optional(MqttAlpnProtocolSchema),
});

/** The persisted MqttRequest shape with the proxy mode / URL tie —
 *  see {@link proxyPairChecks}. */
export const MqttRequestSchema = v.pipe(
  MqttRequestObjectSchema,
  ...proxyPairChecks<v.InferOutput<typeof MqttRequestObjectSchema>>(),
);

/**
 * Content-only shape (no `schemaVersion` / `uid` / `path`) — the
 * pre-fill handoff unit, mirroring `WebSocketRequestSeedSchema`.
 */
export const MqttRequestSeedSchema = v.omit(MqttRequestObjectSchema, ['schemaVersion', 'uid', 'path', 'pathSegment']);
