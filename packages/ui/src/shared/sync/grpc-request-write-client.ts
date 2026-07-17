/**
 * Renderer-side imperative entry point for GrpcRequest writes.
 *
 * Mirrors {@link request-write-client}: write sites build a
 * `MutationBatch` against the active gRPC-request mirror and fire
 * `oh.sync.apply` directly — no SW round-trip per write. The
 * synchronous-render discipline (§19.4) lives in the editor; this
 * helper is what it reaches for once the user commits.
 */

import { GRPC_REQUEST_METADATA_PATH } from '@openheaders/core/sync';
import {
  buildGrpcAddBatch,
  buildGrpcDeleteBatch,
  buildGrpcUpdateBatch,
} from '@openheaders/core/sync-builders/mutations/grpc-request-mutations';
import type { GrpcRequest } from '@openheaders/core/types';
import {
  type GrpcRequestSyncMirror,
  getGrpcRequestSyncMirrorForWorkspace,
} from '../../context/mirrors/grpc-request-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

export type GrpcRequestUpdates = Partial<Omit<GrpcRequest, 'uid' | 'path' | 'schemaVersion'>>;

export type GrpcRequestMutationResult =
  | { ok: true; grpcRequest: GrpcRequest }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type GrpcRequestSimpleResult = SyncSimpleResult;

export interface GrpcRequestWriteOptions extends BaseSyncWriteOptions {
  /** Override the singleton mirror for tests. */
  mirror?: GrpcRequestSyncMirror;
}

/**
 * Apply a partial GrpcRequest patch through the local oracle. Returns
 * `{ ok: true, grpcRequest }` with an optimistic merge of `updates`
 * into the mirror's pre-image.
 */
export async function applyGrpcRequestUpdate(
  grpcRequestUid: string,
  updates: GrpcRequestUpdates,
  opts: GrpcRequestWriteOptions,
): Promise<GrpcRequestMutationResult> {
  const mirror = resolveMirror(opts, getGrpcRequestSyncMirrorForWorkspace);
  // Hydration must complete before the mirror read — see
  // {@link applyRequestUpdate} for the fresh-boot race this closes.
  await mirror.hydrated;
  const entry = mirror.getGrpcRequestMirror(grpcRequestUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildGrpcUpdateBatch(
    grpcRequestUid,
    updates,
    ctx,
    (uid, path) => {
      const orderKeys = mirror.liveOrderedSetItems(uid, path);
      if (orderKeys.length === 0) return [];
      const snap = mirror.getGrpcRequestMirror(uid)?.grpcRequest;
      const rows = snap && path === GRPC_REQUEST_METADATA_PATH ? snap.metadata : undefined;
      if (!rows) return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: undefined }));
      const byUid = new Map<string, unknown>();
      for (const row of rows) byUid.set(row.uid, row);
      return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: byUid.get(e.itemId) }));
    },
    // Baseline for the method / specLink per-leaf flatten-diff.
    (uid, path) => {
      const snap = mirror.getGrpcRequestMirror(uid)?.grpcRequest;
      if (!snap) return undefined;
      if (path === 'method') return snap.method;
      if (path === 'auth') return snap.auth;
      if (path === 'specLink') return snap.specLink;
      return undefined;
    },
  );
  const ack = await applySyncPayload(payload);
  if (ack.ok) {
    return { ok: true, grpcRequest: { ...entry.grpcRequest, ...updates } as GrpcRequest };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/** Seed a brand-new gRPC request through the oracle. Caller mints the
 *  full `GrpcRequest` shape; the helper handles the create + per-row
 *  addToSet envelopes via the projection layer. */
export async function applyGrpcRequestCreate(
  request: GrpcRequest,
  opts: GrpcRequestWriteOptions,
): Promise<GrpcRequestSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildGrpcAddBatch(request, ctx);
  return applySyncPayload(payload);
}

export async function applyGrpcRequestDelete(
  grpcRequestUid: string,
  opts: GrpcRequestWriteOptions,
): Promise<GrpcRequestSimpleResult> {
  const mirror = resolveMirror(opts, getGrpcRequestSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getGrpcRequestMirror(grpcRequestUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildGrpcDeleteBatch(grpcRequestUid, ctx);
  return applySyncPayload(payload);
}
