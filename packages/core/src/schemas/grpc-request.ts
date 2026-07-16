/**
 * Valibot schema for `GrpcRequest` — the native gRPC call entity.
 *
 * Own entity kind beside the HTTP `Request` (never a discriminant on
 * it): session-shaped protocols get their own editor and executor
 * plane, so the schema carries only what a gRPC call needs — target
 * host + TLS flag, a service/rpc method reference, one canonical-JSON
 * request message, metadata pairs, and an optional binding to the
 * Protobuf spec that feeds the method selector.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';
import { RequestTimeoutMsSchema } from './request';

/**
 * gRPC target: authority (`host` or `host:port`) without a scheme —
 * whether the channel is TLS rides the separate `tls` flag, so the
 * editor's lock toggle is a boolean flip, not URL surgery. Kept a
 * plain bounded string (templates welcome — `{{host}}` is the
 * expected idiom); reachability is a connect-time question.
 */
export const MAX_GRPC_URL_LENGTH = 2_048;

export const GrpcUrlSchema = v.pipe(v.string(), v.maxLength(MAX_GRPC_URL_LENGTH));

/**
 * Selected rpc: the service's protobuf full name (`library.v1.Library`)
 * plus the rpc's own name (`ListBooks`). Plain strings — resolution
 * against the linked spec's registry happens at consume time, so a
 * method whose spec drifted away renders as unresolved in the selector
 * instead of failing validation here.
 */
export const GrpcMethodRefSchema = v.object({
  service: v.pipe(v.string(), v.minLength(1)),
  rpc: v.pipe(v.string(), v.minLength(1)),
});

/**
 * One metadata pair sent as a custom header on the call. Same row
 * anatomy as `RequestHeaderSchema`: `uid` is the stable per-row
 * identity the sync engine's set-modeled paths key by; two rows may
 * share a `key` (gRPC metadata allows repeated keys) but never a `uid`.
 */
export const GrpcMetadataPairSchema = v.object({
  uid: UidSchema,
  key: v.string(),
  value: v.string(),
  /** Optional free-form per-row note rendered in the Description column. */
  description: v.optional(v.string()),
  enabled: v.optional(v.boolean()),
});

/**
 * Binding to the Protobuf spec that feeds the method selector —
 * ids-only identity (the spec may be deleted later; the editor derives
 * link health at read time). Deliberately NOT the collection's
 * `SpecLink` shape: that one carries a generation-time `sourceHash`
 * because generated collections judge drift; the gRPC editor rebuilds
 * its registry from the spec's live files on every consume, so there
 * is no cached state to compare against.
 */
export const GrpcSpecLinkSchema = v.object({
  specUid: UidSchema,
});

export const GrpcRequestSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  name: v.string(),
  /** Free-form Markdown notes (Docs-tab parity with the HTTP request). */
  description: v.optional(v.string()),
  url: GrpcUrlSchema,
  /** TLS channel flag — the editor's lock. Absent = TLS on (the safe default). */
  tls: v.optional(v.boolean()),
  /** Absent until the user picks an rpc from the selector. */
  method: v.optional(GrpcMethodRefSchema),
  /**
   * Request message as canonical protobuf JSON text. Fans out to the
   * `message.json` sibling on disk (the `body.json` precedent); the
   * manifest never carries it. Empty string = nothing composed yet.
   */
  message: v.string(),
  metadata: v.array(GrpcMetadataPairSchema),
  specLink: v.optional(GrpcSpecLinkSchema),
  /**
   * Wall-clock ceiling (ms) on the whole call — becomes the gRPC
   * deadline once the transport lands (Phase D). Same bounds as the
   * HTTP request's timeout knob.
   */
  timeoutMs: v.optional(RequestTimeoutMsSchema),
});

/**
 * Content-only shape (no `schemaVersion` / `uid` / `path`) — the
 * pre-fill handoff unit for the create tab, mirroring `RequestSeedSchema`.
 */
export const GrpcRequestSeedSchema = v.omit(GrpcRequestSchema, ['schemaVersion', 'uid', 'path']);
