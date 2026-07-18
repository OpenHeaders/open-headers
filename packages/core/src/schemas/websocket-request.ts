/**
 * Valibot schema for `WebSocketRequest` — the native WebSocket session
 * entity.
 *
 * Own entity kind beside the HTTP `Request` and `GrpcRequest` (never a
 * discriminant on the HTTP request): session-shaped protocols get
 * their own editor and executor plane. One entity covers the whole
 * wire family — the `flavor` field distinguishes a raw WebSocket
 * session from a Socket.IO one (identical session anatomy: connect,
 * bidirectional messages, close; only the handshake and the compose
 * surface differ), so the creation menu's two entries pre-set the
 * flavor instead of minting sibling entity kinds.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';
import { RequestTimeoutMsSchema } from './request';

/**
 * Session target: full `ws://` / `wss://` URL. Kept a plain bounded
 * string (templates welcome — `{{host}}` is the expected idiom); the
 * editor's scheme lock keeps the input honest, and reachability is a
 * connect-time question.
 */
export const MAX_WEBSOCKET_URL_LENGTH = 2_048;

export const WebSocketUrlSchema = v.pipe(v.string(), v.maxLength(MAX_WEBSOCKET_URL_LENGTH));

/**
 * Wire-family discriminant. `raw` composes free-form payloads over the
 * plain WebSocket handshake; `socketio` composes event name +
 * arguments over the engine.io handshake (execution lands with its
 * phase — the field exists from birth so creation gestures persist the
 * user's choice).
 */
export const WebSocketFlavorSchema = v.picklist(['raw', 'socketio']);

/**
 * One handshake header row. Same row anatomy as `RequestHeaderSchema`:
 * `uid` is the stable per-row identity the sync engine's set-modeled
 * paths key by; two rows may share a `key` but never a `uid`. Custom
 * handshake headers are a node-host capability — the browser's
 * WebSocket constructor cannot set them, so the extension surfaces
 * them honestly instead of silently dropping them.
 */
export const WebSocketHeaderPairSchema = v.object({
  uid: UidSchema,
  key: v.string(),
  value: v.string(),
  /** Optional free-form per-row note rendered in the Description column. */
  description: v.optional(v.string()),
  enabled: v.optional(v.boolean()),
});

/**
 * One query-param row appended to the session URL. Mirrors
 * `QueryParamSchema` including the `hasEquals` round-trip marker (see
 * that schema for why `?key` vs `?key=` must survive the URL sync).
 */
export const WebSocketQueryParamSchema = v.object({
  /** See {@link WebSocketHeaderPairSchema.uid}. */
  uid: UidSchema,
  key: v.string(),
  value: v.string(),
  /** Optional free-form per-row note rendered in the Description column. */
  description: v.optional(v.string()),
  enabled: v.optional(v.boolean()),
  /** Marks the `=` separator as present even when `value` is empty. */
  hasEquals: v.optional(v.boolean()),
});

/**
 * Compose-draft display mode for the raw flavor: free text or JSON
 * (JSON gets the structured editor + validation). Display-side only —
 * the payload travels verbatim either way. Absent = `text`.
 */
export const WebSocketMessageFormatSchema = v.picklist(['text', 'json']);

/**
 * Binding to the AsyncAPI spec that feeds compose aids — ids-only
 * identity (the spec may be deleted later; the editor derives link
 * health at read time). Same posture as `GrpcSpecLinkSchema`: no
 * `sourceHash` because there is no generation-time state to drift
 * from — the census is rebuilt from the spec's live files at consume.
 */
export const WebSocketSpecLinkSchema = v.object({
  specUid: UidSchema,
});

export const WebSocketRequestSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  name: v.string(),
  /** Free-form Markdown notes (Docs-tab parity with the HTTP request). */
  description: v.optional(v.string()),
  url: WebSocketUrlSchema,
  flavor: WebSocketFlavorSchema,
  /**
   * Socket.IO namespace the session CONNECTs to (socketio flavor
   * only). Absent or empty = the root `/`. Templates welcome —
   * resolved at Connect with the other target fields.
   */
  namespace: v.optional(v.string()),
  /**
   * `Sec-WebSocket-Protocol` offer list, in preference order. Plain
   * strings — the server picks one during the handshake. Empty = no
   * subprotocol negotiation.
   */
  subprotocols: v.array(v.pipe(v.string(), v.minLength(1))),
  headers: v.array(WebSocketHeaderPairSchema),
  params: v.array(WebSocketQueryParamSchema),
  /**
   * Compose draft for the next outgoing message. Fans out to the
   * message sibling file on disk (the `message.json` precedent); the
   * manifest never carries it. Empty string = nothing composed yet.
   */
  message: v.string(),
  /**
   * Socket.IO compose: the event name the next Send emits (socketio
   * flavor only — `message` then holds the JSON arguments array).
   * Templates welcome, resolved per send.
   */
  eventName: v.optional(v.string()),
  /**
   * Socket.IO compose: opt-in ack — a Send mints an ack id so the
   * server's ACK reply correlates in the timeline. Absent = off.
   */
  ackEnabled: v.optional(v.boolean()),
  /** Raw-flavor compose display mode. Absent = `text`. */
  messageFormat: v.optional(WebSocketMessageFormatSchema),
  specLink: v.optional(WebSocketSpecLinkSchema),
  /**
   * Wall-clock ceiling (ms) on the connection handshake — the
   * transport's open deadline. An OPEN session has no ceiling. Same
   * bounds as the HTTP request's timeout knob.
   */
  timeoutMs: v.optional(RequestTimeoutMsSchema),
  /**
   * Verify the server certificate against the system roots. Absent =
   * verify (the safe default); `false` accepts self-signed `wss:`
   * servers. Node-host capability, like custom handshake headers.
   */
  sslVerification: v.optional(v.boolean()),
});

/**
 * Content-only shape (no `schemaVersion` / `uid` / `path`) — the
 * pre-fill handoff unit for the create tab, mirroring `RequestSeedSchema`.
 */
export const WebSocketRequestSeedSchema = v.omit(WebSocketRequestSchema, ['schemaVersion', 'uid', 'path']);
