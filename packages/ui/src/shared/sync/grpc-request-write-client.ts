/**
 * Renderer-side imperative entry point for GrpcRequest writes.
 *
 * Mirrors {@link request-write-client}: write sites build a
 * `MutationBatch` against the active gRPC-request mirror and fire
 * `oh.sync.apply` directly — no SW round-trip per write. The
 * synchronous-render discipline (§19.4) lives in the editor; this
 * helper is what it reaches for once the user commits.
 */

import { GRPC_REQUEST_ENTITY_TYPE, GRPC_REQUEST_METADATA_PATH } from '@openheaders/core/sync';
import {
  buildGrpcAddBatch,
  buildGrpcDeleteBatch,
  buildGrpcDeleteEntityBatch,
  buildGrpcUpdateBatch,
} from '@openheaders/core/sync-builders/mutations/grpc-request-mutations';
import type { GrpcRequest } from '@openheaders/core/types';
import { parentPathOf } from '@openheaders/core/utils';
import {
  type GrpcRequestSyncMirror,
  getGrpcRequestSyncMirrorForWorkspace,
} from '../../context/mirrors/grpc-request-sync-mirror';
import type { GrpcResponseExampleSyncMirror } from '../../context/mirrors/grpc-response-example-sync-mirror';
import type { RequestCollectionSyncMirror } from '../../context/mirrors/request-collection-sync-mirror';
import type { RequestFolderSyncMirror } from '../../context/mirrors/request-folder-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';
import { applyRequestExampleDeletes, requestExamples } from './tree-descendants';
import { requestTreeMirrors, resolveChildPlacement, resolveLeafParent, unresolvableParent } from './tree-placement';

export type GrpcRequestUpdates = Partial<Omit<GrpcRequest, 'uid' | 'path' | 'pathSegment' | 'schemaVersion'>>;

export type GrpcRequestMutationResult =
  | { ok: true; grpcRequest: GrpcRequest }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type GrpcRequestSimpleResult = SyncSimpleResult;

export interface GrpcRequestWriteOptions extends BaseSyncWriteOptions {
  /** Override the singleton mirror for tests. */
  mirror?: GrpcRequestSyncMirror;
  /** Override the response-example mirror the delete cascade reads (tests). */
  exampleMirror?: GrpcResponseExampleSyncMirror;
  /** Override the parent-resolving container mirrors for tests. */
  collectionMirror?: RequestCollectionSyncMirror;
  folderMirror?: RequestFolderSyncMirror;
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
    // Baseline for the method / auth / specLink / scripts per-leaf
    // flatten-diff — a save writes only the script slots that changed
    // and tombstones the ones the draft emptied.
    (uid, path) => {
      const snap = mirror.getGrpcRequestMirror(uid)?.grpcRequest;
      if (!snap) return undefined;
      if (path === 'method') return snap.method;
      if (path === 'auth') return snap.auth;
      if (path === 'specLink') return snap.specLink;
      if (path === 'scripts') return snap.scripts;
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

/**
 * Seed a brand-new gRPC request through the oracle. Caller mints the
 * full `GrpcRequest` shape; the helper resolves the parent from the
 * request's path (its `items` slot rides the create batch) and handles
 * the per-row addToSet envelopes via the projection layer. An
 * unplaceable parent fails the create.
 */
export async function applyGrpcRequestCreate(
  request: GrpcRequest,
  opts: GrpcRequestWriteOptions,
): Promise<GrpcRequestSimpleResult> {
  const parentPath = parentPathOf(request.path) ?? '';
  const placement = await resolveChildPlacement(requestTreeMirrors(opts.workspaceId, opts), parentPath);
  if (!placement) return unresolvableParent(parentPath);
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildGrpcAddBatch(request, ctx, placement);
  return applySyncPayload(payload);
}

export async function applyGrpcRequestDelete(
  grpcRequestUid: string,
  opts: GrpcRequestWriteOptions,
): Promise<GrpcRequestSimpleResult> {
  const mirror = resolveMirror(opts, getGrpcRequestSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getGrpcRequestMirror(grpcRequestUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  // Cascade: the request's examples go first (`tree-descendants.ts`).
  const examples = await requestExamples(
    opts.workspaceId,
    { grpcMirror: mirror, grpcExampleMirror: opts.exampleMirror },
    { type: GRPC_REQUEST_ENTITY_TYPE, uid: grpcRequestUid },
  );
  const handle = resolveRendererContext(opts);
  const cascade = await applyRequestExampleDeletes(examples, handle, `request-delete-cascade-${grpcRequestUid}`);
  if (!cascade.ok) return cascade;
  // The parent's `items` slot tombstones with the entity; an
  // unresolvable parent (already tombstoned) takes the bare tombstone.
  const parent = await resolveLeafParent(requestTreeMirrors(opts.workspaceId, opts), entry.grpcRequest.path);
  const ctx = handle.next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(
    parent ? buildGrpcDeleteBatch(grpcRequestUid, parent, ctx) : buildGrpcDeleteEntityBatch(grpcRequestUid, ctx),
  );
}
