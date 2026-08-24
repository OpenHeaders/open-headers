/**
 * MqttRequest types for the git-based workspace format.
 *
 * An MqttRequest is a standalone MQTT session request — its own entity
 * kind beside the HTTP `Request`, `GrpcRequest` and `WebSocketRequest`
 * (S8 scope law: session-shaped protocols are never a discriminant on
 * the HTTP request). On disk, each MQTT request is a folder containing:
 *   mqtt.yaml — schemaVersion, uid, name, url, protocolVersion,
 *               publish-compose scalars, topics/savedMessages/
 *               userProperties rows, lastWill, specLink, connect knobs
 *   payload.json / payload.txt — publish-compose draft
 *               (format-matched sibling)
 *
 * The 8-char uid is embedded in `mqtt.yaml` and mirrored in the folder
 * name's `<slug>-<uid>` suffix (slug is a human hint; uid is the
 * identity). Persisted shapes derive from the valibot schemas so the
 * runtime validator and the type stay locked together.
 */

import type * as v from 'valibot';
import type {
  MqttAuthSchema,
  MqttLastWillSchema,
  MqttMessagePropertiesSchema,
  MqttPayloadFormatSchema,
  MqttProtocolVersionSchema,
  MqttQosSchema,
  MqttRequestSchema,
  MqttRequestSeedSchema,
  MqttRetainHandlingSchema,
  MqttSavedMessageSchema,
  MqttSpecLinkSchema,
  MqttTopicRowSchema,
  MqttUserPropertyRowSchema,
} from '../schemas/mqtt-request';

/** Protocol-version knob — `5.0` (default when absent) or `3.1.1`. */
export type MqttRequestProtocolVersion = v.InferOutput<typeof MqttProtocolVersionSchema>;

/** Quality-of-service level (0/1/2). */
export type MqttRequestQos = v.InferOutput<typeof MqttQosSchema>;

/** Compose payload ENCODING — base64/hex author binary payloads. */
export type MqttPayloadFormat = v.InferOutput<typeof MqttPayloadFormatSchema>;

/** One user-property row (CONNECT set path + nested property blocks). */
export type MqttUserPropertyRow = v.InferOutput<typeof MqttUserPropertyRowSchema>;

/** Per-message 5.0 property block (publish compose / saved message / will). */
export type MqttMessageProperties = v.InferOutput<typeof MqttMessagePropertiesSchema>;

/** 5.0 Retain Handling subscription option (0/1/2). */
export type MqttRetainHandling = v.InferOutput<typeof MqttRetainHandlingSchema>;

/** One Topics-tab subscription row — the stored draft the session subscribes from. */
export type MqttTopicRow = v.InferOutput<typeof MqttTopicRowSchema>;

/** One Saved-messages rail row — a reusable, synced publish preset. */
export type MqttSavedMessage = v.InferOutput<typeof MqttSavedMessageSchema>;

/** Last-will block registered on CONNECT (absent = no will). */
export type MqttLastWill = v.InferOutput<typeof MqttLastWillSchema>;

/** Session credential on the CONNECT packet (Basic; absent = none). */
export type MqttAuth = v.InferOutput<typeof MqttAuthSchema>;

/** Ids-only binding to the AsyncAPI spec feeding compose aids. */
export type MqttSpecLink = v.InferOutput<typeof MqttSpecLinkSchema>;

export type MqttRequest = v.InferOutput<typeof MqttRequestSchema>;

/**
 * Content-only shape (no `uid` / `path` / `schemaVersion`) — the
 * pre-fill handoff unit for the create tab.
 */
export type MqttRequestSeed = v.InferOutput<typeof MqttRequestSeedSchema>;
