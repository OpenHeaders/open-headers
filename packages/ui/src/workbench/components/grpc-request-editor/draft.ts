/**
 * gRPC request editor draft — the form-local shape plus the
 * draft ⇄ entity projections. Mirrors the HTTP request editor's
 * `draft.ts` anatomy: `draftFromGrpcRequest` populates the form,
 * `buildGrpcRequestUpdates` emits the save patch, and
 * `canonicalGrpcRequestProjection` projects the live entity into the
 * same shape so the dirty fingerprint compares apples-to-apples
 * (derived dirty — never setDirty).
 */

import type { GrpcAuth, GrpcMetadataPair, GrpcMethodRef, GrpcRequest, GrpcSpecLink } from '@openheaders/core/types';
import { type KeyValueRow, makeKvRow } from '../request-editor/KeyValueTable';

export interface GrpcDraft {
  /** Docs-tab markdown; always concrete in the form (`''` = no docs) —
   *  the save patch emits it verbatim so clearing round-trips (an
   *  update skips only `undefined` values, the `auth` posture). */
  description: string;
  url: string;
  tls: boolean;
  method: GrpcMethodRef | undefined;
  message: string;
  metadata: KeyValueRow[];
  /** Always concrete in the form (`{type:'none'}` = no credential) —
   *  the save patch emits it verbatim, so clearing a bearer token
   *  round-trips (an update skips only `undefined` values). */
  auth: GrpcAuth;
  specLink: GrpcSpecLink | undefined;
  /** Local socket / named pipe the call dials instead of TCP —
   *  `undefined` = a normal TCP connection. */
  unixSocketPath: string | undefined;
  timeoutMs: number | undefined;
  /** Concrete like `auth` — absent on the entity reads as `true`. */
  sslVerification: boolean;
}

export interface GrpcRequestUpdates {
  description: string;
  url: string;
  tls: boolean;
  method: GrpcMethodRef | undefined;
  message: string;
  metadata: GrpcMetadataPair[];
  auth: GrpcAuth;
  specLink: GrpcSpecLink | undefined;
  unixSocketPath: string | undefined;
  timeoutMs: number | undefined;
  sslVerification: boolean;
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
    method: req.method,
    message: req.message,
    metadata: metadataToRows(req.metadata),
    auth: req.auth ?? { type: 'none' },
    specLink: req.specLink,
    unixSocketPath: req.unixSocketPath,
    timeoutMs: req.timeoutMs,
    sslVerification: req.sslVerification ?? true,
  };
}

export function buildGrpcRequestUpdates(draft: GrpcDraft): GrpcRequestUpdates {
  return {
    description: draft.description,
    url: draft.url,
    tls: draft.tls,
    method: draft.method,
    message: draft.message,
    metadata: rowsToMetadata(draft.metadata),
    auth: draft.auth,
    specLink: draft.specLink,
    unixSocketPath: draft.unixSocketPath,
    timeoutMs: draft.timeoutMs,
    sslVerification: draft.sslVerification,
  };
}

/** Project a live `GrpcRequest` into the same shape
 *  `buildGrpcRequestUpdates` emits — fingerprint comparison stays
 *  apples-to-apples. */
export function canonicalGrpcRequestProjection(req: GrpcRequest): GrpcRequestUpdates {
  return buildGrpcRequestUpdates(draftFromGrpcRequest(req));
}
