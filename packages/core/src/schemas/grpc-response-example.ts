/**
 * gRPC Response Example schema — a snapshot of one executed gRPC
 * exchange, saved under a GrpcRequest ("Save Response"). Own entity
 * kind beside the HTTP `ResponseExample` (the `Request`/`GrpcRequest`
 * precedent) — never a discriminant on it: the captured exchange is a
 * different shape end to end (authority + method ref + metadata in,
 * status pair + direction-tagged wire frames out).
 *
 * Captures the request shape as composed at capture time (authored
 * values, variable refs unresolved) plus the settled invoke's response
 * facts verbatim. After capture the blocks stay editable — an example
 * doubles as an authored documentation record — while `capturedAt`
 * records the original capture moment as a historical fact.
 *
 * Deliberately excluded from the capture:
 *   - auth config — may hold secrets; the example records the exchange,
 *     not the credentials that produced it (the HTTP example's law).
 *   - volatile execution internals: the HTTP/2 `:status` ceremony,
 *     `executedOn` attribution, and error classifications — Save
 *     Response only offers on a settled non-error result.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';
import { GrpcMetadataPairSchema, GrpcMethodRefSchema, GrpcUrlSchema } from './grpc-request';
import { RequestTimeoutMsSchema } from './request';

/** Request shape as composed — authored values, variable refs unresolved.
 *  `tls` / `sslVerification` record the concrete flags the invoke used
 *  (the entity's absent-means-default never rides a capture). NO auth. */
export const CapturedGrpcRequestSchema = v.object({
  url: GrpcUrlSchema,
  tls: v.boolean(),
  sslVerification: v.boolean(),
  /** The invoked rpc. Optional to stay honest about the compose shape,
   *  though a settled invoke always had one. */
  method: v.optional(GrpcMethodRefSchema),
  metadata: v.array(GrpcMetadataPairSchema),
  /** Request message as canonical protobuf JSON text, verbatim. */
  message: v.string(),
  timeoutMs: v.optional(RequestTimeoutMsSchema),
});

/** One captured message frame — unframed wire bytes base64-encoded with
 *  the frame's compression flag as received. Streaming captures tag
 *  every frame's direction; absent = down, the unary capture's shape
 *  (mirrors `ExecutedGrpcMessageFrame`). */
export const CapturedGrpcMessageFrameSchema = v.object({
  dataBase64: v.string(),
  compressed: v.boolean(),
  direction: v.optional(v.picklist(['up', 'down'])),
});

/** One reply metadata / trailer field, verbatim wire order. */
export const CapturedGrpcFieldSchema = v.object({ key: v.string(), value: v.string() });

/** Response side of the captured exchange — the settled snapshot's
 *  facts, never rewritten to look well-formed. */
export const CapturedGrpcResponseSchema = v.object({
  /** The reply's `grpc-status`; `null` = the server sent none anywhere. */
  grpcStatus: v.nullable(v.number()),
  /** `grpc-message`, percent-decoded; absent when the server sent none. */
  grpcMessage: v.optional(v.string()),
  /** Where the status was found; `null` with a null status. */
  statusSource: v.nullable(v.picklist(['trailers', 'headers'])),
  /** Initial metadata (the response HEADERS frame), wire order. */
  metadata: v.array(CapturedGrpcFieldSchema),
  /** Trailer fields, verbatim — empty for trailers-only replies. */
  trailers: v.array(CapturedGrpcFieldSchema),
  /** Message frames in call order, both directions for streams. */
  messages: v.array(CapturedGrpcMessageFrameSchema),
  /** True when the body ended mid-frame at capture. */
  incompleteTail: v.optional(v.boolean()),
  /** True when the response exceeded the executor's byte cap. */
  bodyTruncated: v.boolean(),
  /** The cap applied when truncated — present only with `bodyTruncated`. */
  bodyCapBytes: v.optional(v.number()),
  /** Framed body bytes read off the wire before any truncation. */
  bodyBytes: v.number(),
  durationMs: v.number(),
  /** True when the user stopped a streaming call after the head — the
   *  capture holds what arrived. */
  stopped: v.optional(v.boolean()),
});

export const GrpcResponseExampleSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  /** `<grpcRequestPath>/examples/<slug>-<uid>` — nested under the parent request's folder. */
  path: RelativePathSchema,
  /** Parent GrpcRequest identity. */
  grpcRequestUid: UidSchema,
  name: v.pipe(v.string(), v.minLength(1)),
  /** ISO timestamp of the capture moment — a historical fact. */
  capturedAt: v.string(),
  request: CapturedGrpcRequestSchema,
  response: CapturedGrpcResponseSchema,
});
