/**
 * gRPC request editor draft — the form-local shape plus the
 * draft ⇄ entity projections. Mirrors the HTTP request editor's
 * `draft.ts` anatomy: `draftFromGrpcRequest` populates the form,
 * `buildGrpcRequestUpdates` emits the save patch, and
 * `canonicalGrpcRequestProjection` projects the live entity into the
 * same shape so the dirty fingerprint compares apples-to-apples
 * (derived dirty — never setDirty).
 */

import type { GrpcMetadataPair, GrpcMethodRef, GrpcRequest, GrpcSpecLink } from '@openheaders/core/types';
import { type KeyValueRow, makeKvRow } from '../request-editor/KeyValueTable';

export interface GrpcDraft {
  url: string;
  tls: boolean;
  method: GrpcMethodRef | undefined;
  message: string;
  metadata: KeyValueRow[];
  specLink: GrpcSpecLink | undefined;
  timeoutMs: number | undefined;
}

export interface GrpcRequestUpdates {
  url: string;
  tls: boolean;
  method: GrpcMethodRef | undefined;
  message: string;
  metadata: GrpcMetadataPair[];
  specLink: GrpcSpecLink | undefined;
  timeoutMs: number | undefined;
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
    url: req.url,
    tls: req.tls ?? true,
    method: req.method,
    message: req.message,
    metadata: metadataToRows(req.metadata),
    specLink: req.specLink,
    timeoutMs: req.timeoutMs,
  };
}

export function buildGrpcRequestUpdates(draft: GrpcDraft): GrpcRequestUpdates {
  return {
    url: draft.url,
    tls: draft.tls,
    method: draft.method,
    message: draft.message,
    metadata: rowsToMetadata(draft.metadata),
    specLink: draft.specLink,
    timeoutMs: draft.timeoutMs,
  };
}

/** Project a live `GrpcRequest` into the same shape
 *  `buildGrpcRequestUpdates` emits — fingerprint comparison stays
 *  apples-to-apples. */
export function canonicalGrpcRequestProjection(req: GrpcRequest): GrpcRequestUpdates {
  return buildGrpcRequestUpdates(draftFromGrpcRequest(req));
}
