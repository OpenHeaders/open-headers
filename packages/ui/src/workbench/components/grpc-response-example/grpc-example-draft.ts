/**
 * gRPC example editor draft model + the pure capture projections —
 * the `example-draft` sibling for the GrpcRequest family.
 *
 * The editable half is the captured REQUEST block (an example doubles
 * as an authored record): url, TLS flag, metadata rows, message text.
 * The response block is wire-frame capture — bytes, status pair,
 * trailers — and stays a read-only fact rendered through the result
 * pane. Two pure projections feed save and derived-dirty; the
 * fingerprint is uid-free because metadata rows mint fresh row uids on
 * every populate.
 */

import type {
  CapturedGrpcRequest,
  CapturedGrpcResponse,
  ExecutedGrpcSnapshot,
  GrpcResponseExample,
} from '@openheaders/core/types';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { metadataToRows, rowsToMetadata } from '../grpc-request-editor/draft';
import type { KeyValueRow } from '../request-editor/KeyValueTable';

export interface GrpcExampleDraft {
  url: string;
  tls: boolean;
  sslVerification: boolean;
  method: CapturedGrpcRequest['method'];
  metadata: KeyValueRow[];
  message: string;
  timeoutMs: number | undefined;
}

export function grpcExampleToDraft(example: GrpcResponseExample): GrpcExampleDraft {
  return {
    url: example.request.url,
    tls: example.request.tls,
    sslVerification: example.request.sslVerification,
    method: example.request.method,
    metadata: metadataToRows(example.request.metadata),
    message: example.request.message,
    timeoutMs: example.request.timeoutMs,
  };
}

/**
 * The persisted request block from a compose shape — the gRPC editor's
 * CURRENT draft at "Save Response" time (authored values, variable
 * refs unresolved) or the example editor's own draft at save. Both
 * speak this structural subset; auth is deliberately NOT part of it —
 * the example records the exchange, not the credentials that produced
 * it.
 */
export function capturedGrpcRequestFromDraft(draft: GrpcExampleDraft): CapturedGrpcRequest {
  return {
    url: draft.url,
    tls: draft.tls,
    sslVerification: draft.sslVerification,
    ...(draft.method === undefined ? {} : { method: draft.method }),
    metadata: rowsToMetadata(draft.metadata),
    message: draft.message,
    ...(draft.timeoutMs === undefined ? {} : { timeoutMs: draft.timeoutMs }),
  };
}

/**
 * The persisted response block from a settled invoke snapshot —
 * status pair, reply fields, and the direction-tagged wire frames
 * verbatim. Volatile execution internals (`httpStatus`, `executedOn`,
 * `error`) stay behind; callers only capture non-error snapshots.
 */
export function capturedGrpcResponseFromSnapshot(snapshot: ExecutedGrpcSnapshot): CapturedGrpcResponse {
  return {
    grpcStatus: snapshot.grpcStatus,
    ...(snapshot.grpcMessage === undefined ? {} : { grpcMessage: snapshot.grpcMessage }),
    statusSource: snapshot.grpcStatusSource,
    metadata: snapshot.headers.map((h) => ({ key: h.key, value: h.value })),
    trailers: snapshot.trailers.map((h) => ({ key: h.key, value: h.value })),
    messages: snapshot.messages.map((m) => ({
      dataBase64: m.dataBase64,
      compressed: m.compressed,
      ...(m.direction === undefined ? {} : { direction: m.direction }),
    })),
    ...(snapshot.incompleteTail === undefined ? {} : { incompleteTail: snapshot.incompleteTail }),
    bodyTruncated: snapshot.bodyTruncated,
    ...(snapshot.bodyCapBytes === undefined ? {} : { bodyCapBytes: snapshot.bodyCapBytes }),
    bodyBytes: snapshot.bodyBytes,
    durationMs: snapshot.durationMs,
    ...(snapshot.stopped === undefined ? {} : { stopped: snapshot.stopped }),
  };
}

/**
 * True when the capture is a streamed call — the executor tags every
 * streamed frame's direction explicitly; unary captures leave it
 * absent.
 */
export function isStreamCapture(response: CapturedGrpcResponse): boolean {
  return response.messages.some((m) => m.direction !== undefined);
}

/** Uid-free structural fingerprint over everything editable. */
export function grpcExampleDraftFingerprint(draft: GrpcExampleDraft): string {
  const stripRow = (r: KeyValueRow) => ({
    key: r.key,
    value: r.value,
    description: r.description?.trim() ? r.description : undefined,
    enabled: r.enabled,
  });
  return stableStringify({
    url: draft.url,
    tls: draft.tls,
    sslVerification: draft.sslVerification,
    method: draft.method,
    metadata: draft.metadata.filter((r) => r.key.trim()).map(stripRow),
    message: draft.message,
    timeoutMs: draft.timeoutMs,
  });
}

/** Canonical-side fingerprint — same projection path as the form's. */
export function grpcExampleSignature(example: GrpcResponseExample): string {
  return grpcExampleDraftFingerprint(grpcExampleToDraft(example));
}
