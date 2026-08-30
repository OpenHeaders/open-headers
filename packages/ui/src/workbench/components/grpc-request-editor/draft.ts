/**
 * gRPC request editor draft — the form-local shape plus the
 * draft ⇄ entity projections. Mirrors the HTTP request editor's
 * `draft.ts` anatomy: `draftFromGrpcRequest` populates the form,
 * `buildGrpcRequestUpdates` emits the save patch, and
 * `canonicalGrpcRequestProjection` projects the live entity into the
 * same shape so the dirty fingerprint compares apples-to-apples
 * (derived dirty — never setDirty).
 */

import type {
  GrpcAuth,
  GrpcMetadataPair,
  GrpcMethodRef,
  GrpcRequest,
  GrpcSpecLink,
  ProxyMode,
  TlsVersion,
} from '@openheaders/core/types';
import { type KeyValueRow, makeKvRow } from '../request-editor/KeyValueTable';

export interface GrpcDraft {
  /** Docs-tab markdown; always concrete in the form (`''` = no docs) —
   *  the save patch emits it verbatim so clearing round-trips (an
   *  update skips only `undefined` values, the `auth` posture). */
  description: string;
  url: string;
  tls: boolean;
  /** `:authority` override — `undefined` = the target itself. */
  authority: string | undefined;
  method: GrpcMethodRef | undefined;
  message: string;
  metadata: KeyValueRow[];
  /** Always concrete in the form (`{type:'none'}` = no credential) —
   *  the save patch emits it verbatim, so clearing a bearer token
   *  round-trips (an update skips only `undefined` values). */
  auth: GrpcAuth;
  specLink: GrpcSpecLink | undefined;
  /** The dial policy — `undefined` = system DNS / the host's proxy
   *  planes (the HTTP request's knobs on the channel). */
  resolveToAddress: string | undefined;
  proxyMode: ProxyMode | undefined;
  proxyUrl: string | undefined;
  proxyCredentialRef: string | undefined;
  /** Local socket / named pipe the call dials instead of TCP —
   *  `undefined` = a normal TCP connection. */
  unixSocketPath: string | undefined;
  timeoutMs: number | undefined;
  /** The response body cap — `undefined` = the runtime's 2 MiB default. */
  maxResponseBytes: number | undefined;
  /** The channel keepalive — `undefined` interval = no pings; the
   *  timeout rides it (`undefined` = the runtime's 20 s default). */
  keepaliveIntervalMs: number | undefined;
  keepaliveTimeoutMs: number | undefined;
  /** Concrete like `auth` — absent on the entity reads as `true`. */
  sslVerification: boolean;
  /** The rest of the TLS policy — `undefined` = the runtime default. */
  clientCertificateRef: string | undefined;
  tlsMinVersion: TlsVersion | undefined;
  tlsMaxVersion: TlsVersion | undefined;
  tlsCipherSuites: string | undefined;
  sniServerName: string | undefined;
}

export interface GrpcRequestUpdates {
  description: string;
  url: string;
  tls: boolean;
  authority: string | undefined;
  method: GrpcMethodRef | undefined;
  message: string;
  metadata: GrpcMetadataPair[];
  auth: GrpcAuth;
  specLink: GrpcSpecLink | undefined;
  resolveToAddress: string | undefined;
  proxyMode: ProxyMode | undefined;
  proxyUrl: string | undefined;
  proxyCredentialRef: string | undefined;
  unixSocketPath: string | undefined;
  timeoutMs: number | undefined;
  maxResponseBytes: number | undefined;
  keepaliveIntervalMs: number | undefined;
  keepaliveTimeoutMs: number | undefined;
  sslVerification: boolean;
  clientCertificateRef: string | undefined;
  tlsMinVersion: TlsVersion | undefined;
  tlsMaxVersion: TlsVersion | undefined;
  tlsCipherSuites: string | undefined;
  sniServerName: string | undefined;
}

export function metadataToRows(pairs: readonly GrpcMetadataPair[]): KeyValueRow[] {
  return pairs.map((p) =>
    makeKvRow({
      uid: p.uid,
      key: p.key,
      value: p.value,
      description: p.description ?? '',
      enabled: p.enabled ?? true,
    }),
  );
}

export function rowsToMetadata(rows: KeyValueRow[]): GrpcMetadataPair[] {
  return rows
    .filter((r) => r.key.trim())
    .map((r) => ({
      uid: r.uid,
      key: r.key,
      value: r.value,
      description: r.description?.trim() ? r.description : undefined,
      enabled: r.enabled,
    }));
}

export function draftFromGrpcRequest(req: GrpcRequest): GrpcDraft {
  return {
    description: req.description ?? '',
    url: req.url,
    tls: req.tls ?? true,
    authority: req.authority,
    method: req.method,
    message: req.message,
    metadata: metadataToRows(req.metadata),
    auth: req.auth ?? { type: 'none' },
    specLink: req.specLink,
    resolveToAddress: req.resolveToAddress,
    proxyMode: req.proxyMode,
    proxyUrl: req.proxyUrl,
    proxyCredentialRef: req.proxyCredentialRef,
    unixSocketPath: req.unixSocketPath,
    timeoutMs: req.timeoutMs,
    maxResponseBytes: req.maxResponseBytes,
    keepaliveIntervalMs: req.keepaliveIntervalMs,
    keepaliveTimeoutMs: req.keepaliveTimeoutMs,
    sslVerification: req.sslVerification ?? true,
    clientCertificateRef: req.clientCertificateRef,
    tlsMinVersion: req.tlsMinVersion,
    tlsMaxVersion: req.tlsMaxVersion,
    tlsCipherSuites: req.tlsCipherSuites,
    sniServerName: req.sniServerName,
  };
}

export function buildGrpcRequestUpdates(draft: GrpcDraft): GrpcRequestUpdates {
  return {
    description: draft.description,
    url: draft.url,
    tls: draft.tls,
    authority: draft.authority,
    method: draft.method,
    message: draft.message,
    metadata: rowsToMetadata(draft.metadata),
    auth: draft.auth,
    specLink: draft.specLink,
    resolveToAddress: draft.resolveToAddress,
    proxyMode: draft.proxyMode,
    proxyUrl: draft.proxyUrl,
    proxyCredentialRef: draft.proxyCredentialRef,
    unixSocketPath: draft.unixSocketPath,
    timeoutMs: draft.timeoutMs,
    maxResponseBytes: draft.maxResponseBytes,
    keepaliveIntervalMs: draft.keepaliveIntervalMs,
    keepaliveTimeoutMs: draft.keepaliveTimeoutMs,
    sslVerification: draft.sslVerification,
    clientCertificateRef: draft.clientCertificateRef,
    tlsMinVersion: draft.tlsMinVersion,
    tlsMaxVersion: draft.tlsMaxVersion,
    tlsCipherSuites: draft.tlsCipherSuites,
    sniServerName: draft.sniServerName,
  };
}

/** Project a live `GrpcRequest` into the same shape
 *  `buildGrpcRequestUpdates` emits — fingerprint comparison stays
 *  apples-to-apples. */
export function canonicalGrpcRequestProjection(req: GrpcRequest): GrpcRequestUpdates {
  return buildGrpcRequestUpdates(draftFromGrpcRequest(req));
}
