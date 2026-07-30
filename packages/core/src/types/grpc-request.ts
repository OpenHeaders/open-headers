/**
 * GrpcRequest types for the git-based workspace format.
 *
 * A GrpcRequest is a standalone gRPC call — its own entity kind beside
 * the HTTP `Request` (S8 scope law: session-shaped protocols are never
 * a discriminant on the HTTP request). On disk, each gRPC request is a
 * folder containing:
 *   grpc.yaml      — schemaVersion, uid, name, url, tls, method,
 *                    metadata, auth, specLink, unixSocketPath,
 *                    timeoutMs, sslVerification
 *   message.json   — request message as canonical protobuf JSON
 *
 * The 8-char uid is embedded in `grpc.yaml` and mirrored in the folder
 * name's `<slug>-<uid>` suffix (slug is a human hint; uid is the
 * identity). Persisted shapes derive from the valibot schemas so the
 * runtime validator and the type stay locked together.
 */

import type * as v from 'valibot';
import type {
  GrpcAuthSchema,
  GrpcMetadataPairSchema,
  GrpcMethodRefSchema,
  GrpcRequestSchema,
  GrpcRequestSeedSchema,
  GrpcSpecLinkSchema,
} from '../schemas/grpc-request';

/** Selected rpc — service full name + rpc name, resolved at consume time. */
export type GrpcMethodRef = v.InferOutput<typeof GrpcMethodRefSchema>;

/** One metadata pair (custom header) sent on the call. */
export type GrpcMetadataPair = v.InferOutput<typeof GrpcMetadataPairSchema>;

/** Call credential injected into metadata at invoke (bearer subset). */
export type GrpcAuth = v.InferOutput<typeof GrpcAuthSchema>;

/** Ids-only binding to the Protobuf spec feeding the method selector. */
export type GrpcSpecLink = v.InferOutput<typeof GrpcSpecLinkSchema>;

export type GrpcRequest = v.InferOutput<typeof GrpcRequestSchema>;

/**
 * Content-only shape (no `uid` / `path` / `schemaVersion`) — the
 * pre-fill handoff unit for the create tab.
 */
export type GrpcRequestSeed = v.InferOutput<typeof GrpcRequestSeedSchema>;
