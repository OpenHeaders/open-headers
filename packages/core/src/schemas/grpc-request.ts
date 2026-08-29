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
import { PathSegmentSchema, RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';
import {
  ClientCertificateRefSchema,
  ProxyCredentialRefSchema,
  ProxyModeSchema,
  ProxyUrlSchema,
  proxyPairChecks,
  RequestTimeoutMsSchema,
  ResolveToAddressSchema,
  SniServerNameSchema,
  TlsCipherSuitesSchema,
  TlsVersionSchema,
  UnixSocketPathSchema,
} from './request';

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
 * Call credential — deliberately a SUBSET of the HTTP `AuthConfigSchema`
 * (bearer is the gRPC idiom: the token rides the `authorization`
 * metadata field). The executor injects the resolved pair at invoke
 * time, so the credential is host-neutral — an in-process and a
 * forwarded invoke inject identically. Absent = `none`. Wider auth
 * shapes (basic, OAuth2, inherit) are demand-gated.
 */
export const GrpcAuthSchema = v.variant('type', [
  v.object({ type: v.literal('none') }),
  v.object({
    type: v.literal('bearer'),
    /** Token text; templates welcome (`{{token}}` resolves at invoke). */
    token: v.string(),
  }),
]);

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

const GrpcRequestObjectSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  pathSegment: v.optional(PathSegmentSchema),
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
  /** Call credential injected into metadata at invoke. Absent = none. */
  auth: v.optional(GrpcAuthSchema),
  specLink: v.optional(GrpcSpecLinkSchema),
  /**
   * Dial this local socket — an absolute Unix domain socket path or a
   * Windows named pipe (`\\.\pipe\…`) — instead of opening a TCP
   * connection, the HTTP request's knob on the gRPC channel. The
   * target keeps its authority: the host becomes COSMETIC for dialing,
   * while `:authority`, SNI, and certificate verification still use it
   * — a TLS channel over the socket verifies against the target's
   * hostname. Honored by node runtimes; browser runtimes cannot dial
   * local sockets and ignore it (the request still syncs it — one
   * schema, all runtimes carry the value). Validated — see
   * {@link UnixSocketPathSchema}.
   */
  unixSocketPath: v.optional(UnixSocketPathSchema),
  /**
   * Resolve the URL's host to this IPv4 / IPv6 address at connect time
   * instead of asking DNS — the HTTP request's knob on the gRPC channel: SNI,
   * `:authority` and certificate verification keep the ORIGINAL hostname;
   * only where the socket goes changes. Node runtimes only.
   * Pattern-validated — see {@link ResolveToAddressSchema}.
   */
  resolveToAddress: v.optional(ResolveToAddressSchema),
  /**
   * Proxy routing mode for the dial — the HTTP request's knob. Absent =
   * INHERIT the executing host's system plane; `'direct'` opts the
   * call out of any ambient proxy; `'url'` routes through `proxyUrl`.
   * The mode / URL pair is tied by the checks on the persisted schema.
   */
  proxyMode: v.optional(ProxyModeSchema),
  /**
   * Route the dial through this proxy instead of connecting directly —
   * an HTTP CONNECT tunnel (the channel's own HTTP/2 session tunnels CONNECT only, so a SOCKS5 URL fails before the wire) — so end-to-end TLS still verifies the TARGET.
   * Incompatible with `resolveToAddress` and `unixSocketPath` (the dial fails
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
   * Wall-clock ceiling (ms) on the whole call — becomes the gRPC
   * deadline once the transport lands (Phase D). Same bounds as the
   * HTTP request's timeout knob.
   */
  timeoutMs: v.optional(RequestTimeoutMsSchema),
  /**
   * Verify the server's TLS certificate against the system roots —
   * the HTTP request's knob, TLS-channel calls only. Absent = verify
   * (the safe default); `false` accepts self-signed dev servers.
   */
  sslVerification: v.optional(v.boolean()),
  /**
   * Vault `client-certificate` entry NAME presented in the TLS
   * handshake — mutual-TLS servers. The PEM pair never rides the
   * request; the executor resolves the ref at connect (the HTTP
   * request's contract). Node runtimes only.
   */
  clientCertificateRef: v.optional(ClientCertificateRefSchema),
  /** Lowest TLS version the dial may negotiate — the HTTP request's
   *  knob. Absent = the runtime floor (1.2); `1.0` / `1.1` lower it
   *  for legacy servers. Node runtimes only. */
  tlsMinVersion: v.optional(TlsVersionSchema),
  /** Highest TLS version the dial may negotiate. Absent = the runtime
   *  ceiling (1.3). Node runtimes only. */
  tlsMaxVersion: v.optional(TlsVersionSchema),
  /** Cipher suites offered on the dial, OpenSSL colon-list. Absent =
   *  the runtime's defaults. Node runtimes only. */
  tlsCipherSuites: v.optional(TlsCipherSuitesSchema),
  /** SNI server name override for the TLS dial. Absent = the target's
   *  host. Templates welcome. Node runtimes only. */
  sniServerName: v.optional(SniServerNameSchema),
});

/** The persisted GrpcRequest shape with the proxy mode / URL tie —
 *  see {@link proxyPairChecks}. */
export const GrpcRequestSchema = v.pipe(
  GrpcRequestObjectSchema,
  ...proxyPairChecks<v.InferOutput<typeof GrpcRequestObjectSchema>>(),
);

/**
 * Content-only shape (no `schemaVersion` / `uid` / `path`) — the
 * pre-fill handoff unit for the create tab, mirroring `RequestSeedSchema`.
 */
export const GrpcRequestSeedSchema = v.omit(GrpcRequestObjectSchema, ['schemaVersion', 'uid', 'path', 'pathSegment']);
