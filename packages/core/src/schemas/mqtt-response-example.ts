/**
 * MQTT Response Example schema — a snapshot of one settled MQTT
 * session, saved under an MqttRequest ("Save Response"). Own entity
 * kind beside the HTTP `ResponseExample`, the `GrpcResponseExample`
 * and the `WsResponseExample` (the `Request`/`GrpcRequest`/
 * `WebSocketRequest`/`MqttRequest` precedent) — never a discriminant
 * on any: the captured exchange is a whole pub/sub session (CONNACK
 * facts + bidirectional publishes + subscription lifecycle + the end
 * record), not a single request/response pair.
 *
 * Captures the request shape as composed at capture time (authored
 * values, variable refs unresolved) plus the settled session's facts
 * verbatim — every payload base64 as it crossed the wire, the QoS /
 * RETAIN / DUP flags as facts, SUBACK grants verbatim, `null` end when
 * the connection severed without a DISCONNECT. After capture the
 * request block stays editable — an example doubles as an authored
 * documentation record — while `capturedAt` records the original
 * capture moment as a historical fact.
 *
 * Deliberately excluded from the capture:
 *   - volatile execution internals: `executedOn` attribution,
 *     `proxyRoute`, and the `error` classification — Save Response
 *     only offers on a settled session that connected (the gRPC
 *     example's law).
 *   - the entity's will / CONNECT user properties / saved messages /
 *     5.0 connect knobs — connect configuration that stays on the
 *     entity; the capture holds the compose + subscription surface the
 *     session actually ran.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';
import {
  MqttMessagePropertiesSchema,
  MqttPayloadFormatSchema,
  MqttProtocolVersionSchema,
  MqttQosSchema,
  MqttTopicRowSchema,
  MqttUrlSchema,
} from './mqtt-request';
import { RequestTimeoutMsSchema } from './request';

/** Request shape as composed — authored values, variable refs
 *  unresolved. Fields the entity leaves optional-with-default record
 *  the CONCRETE value the session used (an absent-means-default never
 *  rides a capture). */
export const CapturedMqttRequestSchema = v.object({
  url: MqttUrlSchema,
  /** The version knob the session ran — a capture fact, never a toggle. */
  protocolVersion: MqttProtocolVersionSchema,
  /** Publish-compose topic as composed. */
  topic: v.string(),
  /** Publish-compose payload as composed. */
  payload: v.string(),
  payloadFormat: MqttPayloadFormatSchema,
  qos: MqttQosSchema,
  retain: v.boolean(),
  /** Per-message 5.0 property block as composed. */
  publishProperties: v.optional(MqttMessagePropertiesSchema),
  /** Subscription rows as composed — what the session subscribed from. */
  topics: v.array(MqttTopicRowSchema),
  /** Client id as authored; absent = generated per connect. */
  clientId: v.optional(v.string()),
  sslVerification: v.boolean(),
  timeoutMs: v.optional(RequestTimeoutMsSchema),
});

/** One captured PUBLISH, in packet order — flags verbatim, payload
 *  base64 whether text or binary (the executor snapshot's byte-honest
 *  shape verbatim). */
export const CapturedMqttMessageSchema = v.object({
  kind: v.literal('message'),
  direction: v.picklist(['up', 'down']),
  topic: v.string(),
  payloadBase64: v.string(),
  qos: MqttQosSchema,
  retain: v.boolean(),
  dup: v.boolean(),
});

/** A SUBSCRIBE acknowledged — SUBACK grants verbatim, at the event's
 *  true position in the log. */
export const CapturedMqttSubscribedSchema = v.object({
  kind: v.literal('subscribed'),
  grants: v.array(v.object({ topicFilter: v.string(), reasonCode: v.number() })),
});

/** An UNSUBSCRIBE acknowledged (a live Subscribe toggle turning off). */
export const CapturedMqttUnsubscribedSchema = v.object({
  kind: v.literal('unsubscribed'),
  topicFilters: v.array(v.string()),
});

/** How the captured session ended — the tri-state end record verbatim:
 *  the clean client DISCONNECT, a broker DISCONNECT with its reason
 *  (`null` = the 3.1.1 wire, which carries none), or `null` when the
 *  connection severed without one — never synthesized. */
export const CapturedMqttEndSchema = v.nullable(
  v.variant('by', [
    v.object({ by: v.literal('client') }),
    v.object({ by: v.literal('broker'), reasonCode: v.nullable(v.number()) }),
  ]),
);

/** An open connection dropped and auto-reconnect took over — how that
 *  connection ended (never a client DISCONNECT). */
export const CapturedMqttLostSchema = v.object({
  kind: v.literal('lost'),
  end: v.nullable(v.object({ by: v.literal('broker'), reasonCode: v.nullable(v.number()) })),
});

/** One reconnect attempt dialed; `error` is the previous attempt's
 *  classified failure when there was one. */
export const CapturedMqttReconnectingSchema = v.object({
  kind: v.literal('reconnecting'),
  attempt: v.number(),
  /** The wait before the attempt — optional: captures saved before it
   *  was recorded carry no value. */
  delayMs: v.optional(v.number()),
  error: v.optional(v.string()),
  forced: v.optional(v.literal(true)),
});

/** A reconnect attempt's CONNACK accepted — the new connection's facts. */
export const CapturedMqttReconnectedSchema = v.object({
  kind: v.literal('reconnected'),
  attempt: v.number(),
  sessionPresent: v.boolean(),
  reasonCode: v.number(),
  remainingLength: v.number(),
  dropped: v.optional(v.number()),
});

/** One captured event of the session's log, in packet order. */
export const CapturedMqttEventSchema = v.variant('kind', [
  CapturedMqttMessageSchema,
  CapturedMqttSubscribedSchema,
  CapturedMqttUnsubscribedSchema,
  CapturedMqttLostSchema,
  CapturedMqttReconnectingSchema,
  CapturedMqttReconnectedSchema,
]);

/** Response side of the captured session — the settled snapshot's
 *  facts, never rewritten to look well-formed. */
export const CapturedMqttResponseSchema = v.object({
  /** The CONNACK as the broker answered it — a capture only exists for
   *  a session that opened, so the facts are always present.
   *  `remainingLength` is the frame's Remaining Length as observed on
   *  the wire — optional: captures saved before it was recorded carry
   *  no value (absence stays absence, never synthesized). */
  connack: v.object({
    sessionPresent: v.boolean(),
    reasonCode: v.number(),
    remainingLength: v.optional(v.number()),
  }),
  /** The client id the CONNECT actually carried — the entity's own, or
   *  the per-connect generated one when the field was blank. */
  clientId: v.string(),
  /** Captured events in packet order under the executor's rolling
   *  retention cap. */
  events: v.array(CapturedMqttEventSchema),
  /** Events that rolled off the retention window, 0 when none did. */
  droppedMessages: v.number(),
  end: CapturedMqttEndSchema,
  /** True when the user stopped the session via Stop-abort rather than
   *  a Disconnect — the capture holds what arrived. */
  stopped: v.optional(v.boolean()),
  /** Auto-reconnect gave up on a CONNACK refusal — the reason verbatim
   *  with the attempt it answered. */
  reconnectRefused: v.optional(v.object({ attempt: v.number(), error: v.string() })),
  /** Auto-reconnect gave up on a spent attempt cap — the attempts
   *  dialed, the last failure verbatim when there was one. */
  reconnectExhausted: v.optional(v.object({ attempts: v.number(), error: v.optional(v.string()) })),
  /** Whole-session wall time (connect start → settle). */
  durationMs: v.number(),
});

export const MqttResponseExampleSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  /** `<mqttRequestPath>/examples/<slug>-<uid>` — nested under the parent request's folder. */
  path: RelativePathSchema,
  /** Parent MqttRequest identity. */
  mqttRequestUid: UidSchema,
  name: v.pipe(v.string(), v.minLength(1)),
  /** ISO timestamp of the capture moment — a historical fact. */
  capturedAt: v.string(),
  request: CapturedMqttRequestSchema,
  response: CapturedMqttResponseSchema,
});
