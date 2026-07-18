/**
 * WebSocket Response Example schema — a snapshot of one settled
 * WebSocket session, saved under a WebSocketRequest ("Save Response").
 * Own entity kind beside the HTTP `ResponseExample` and the
 * `GrpcResponseExample` (the `Request`/`GrpcRequest`/`WebSocketRequest`
 * precedent) — never a discriminant on either: the captured exchange is
 * a whole session (handshake result + bidirectional messages + close),
 * not a single request/response pair.
 *
 * Captures the request shape as composed at capture time (authored
 * values, variable refs unresolved) plus the settled session's facts
 * verbatim — every message payload base64 as it crossed the wire, the
 * close frame exactly as received, `null` close when the connection
 * severed without one. After capture the blocks stay editable — an
 * example doubles as an authored documentation record — while
 * `capturedAt` records the original capture moment as a historical
 * fact.
 *
 * Deliberately excluded from the capture:
 *   - volatile execution internals: `executedOn` attribution and the
 *     `error` classification — Save Response only offers on a settled
 *     session that connected (the gRPC example's law).
 *   - `messageFormat` — a compose display mode, not session fact.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';
import { RequestTimeoutMsSchema } from './request';
import {
  WebSocketFlavorSchema,
  WebSocketHeaderPairSchema,
  WebSocketQueryParamSchema,
  WebSocketUrlSchema,
} from './websocket-request';

/** Request shape as composed — authored values, variable refs
 *  unresolved. `sslVerification` records the concrete flag the session
 *  used (the entity's absent-means-default never rides a capture). */
export const CapturedWsRequestSchema = v.object({
  url: WebSocketUrlSchema,
  flavor: WebSocketFlavorSchema,
  /** Socket.IO namespace as composed (socketio flavor only). */
  namespace: v.optional(v.string()),
  subprotocols: v.array(v.pipe(v.string(), v.minLength(1))),
  headers: v.array(WebSocketHeaderPairSchema),
  params: v.array(WebSocketQueryParamSchema),
  /** Compose draft at capture — the raw payload, or the socketio JSON
   *  arguments array. */
  message: v.string(),
  /** Socket.IO event name as composed (socketio flavor only). */
  eventName: v.optional(v.string()),
  /** Socket.IO ack opt-in as composed (socketio flavor only). */
  ackEnabled: v.optional(v.boolean()),
  sslVerification: v.boolean(),
  timeoutMs: v.optional(RequestTimeoutMsSchema),
});

/** One captured message of the session, in call order — direction
 *  tagged, payload base64 whether the frame was text or binary
 *  (`binary` records which the wire carried), the executor snapshot's
 *  byte-honest shape verbatim. */
export const CapturedWsMessageSchema = v.object({
  direction: v.picklist(['up', 'down']),
  dataBase64: v.string(),
  binary: v.boolean(),
});

/** The Close handshake as the wire answered it — code and reason
 *  verbatim, `wasClean` per the socket's own accounting. */
export const CapturedWsCloseSchema = v.object({
  code: v.number(),
  reason: v.string(),
  wasClean: v.boolean(),
});

/** Response side of the captured session — the settled snapshot's
 *  facts, never rewritten to look well-formed. */
export const CapturedWsResponseSchema = v.object({
  /** The subprotocol the server selected; empty when none negotiated. */
  protocol: v.string(),
  /** The extensions the handshake negotiated; empty when none. */
  extensions: v.string(),
  /** Captured messages in call order under the executor's rolling
   *  retention cap. */
  messages: v.array(CapturedWsMessageSchema),
  /** Messages that rolled off the retention window, 0 when none did. */
  droppedMessages: v.number(),
  /** The Close frame as received (or locally initiated); `null` when
   *  the connection severed without one — never synthesized. */
  close: v.nullable(CapturedWsCloseSchema),
  /** True when the user stopped the session via Stop-abort rather than
   *  a Disconnect close — the capture holds what arrived. */
  stopped: v.optional(v.boolean()),
  /** Whole-session wall time (connect start → settle). */
  durationMs: v.number(),
});

export const WsResponseExampleSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  /** `<websocketRequestPath>/examples/<slug>-<uid>` — nested under the parent request's folder. */
  path: RelativePathSchema,
  /** Parent WebSocketRequest identity. */
  websocketRequestUid: UidSchema,
  name: v.pipe(v.string(), v.minLength(1)),
  /** ISO timestamp of the capture moment — a historical fact. */
  capturedAt: v.string(),
  request: CapturedWsRequestSchema,
  response: CapturedWsResponseSchema,
});
