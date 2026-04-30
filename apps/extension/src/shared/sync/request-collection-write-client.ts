/**
 * Renderer-side imperative entry point for request-collection writes.
 *
 * Mirrors `collection-write-client.ts` but routed through the
 * request-collection entity type. Catalog ships rename-only at v1.
 */

import { applySyncPayload, type SyncSimpleResult } from '@/shared/sync/apply-payload';
import { type MutationEnvelope } from '@openheaders/core/sync';
import {
  getActiveRequestCollectionSyncMirror,
  type RequestCollectionSyncMirror,
} from '@/context/request-collection-sync-mirror';
import {
  ensureRendererContext,
  type RendererContextHandle,
} from '@/context/renderer-mutator-context';
import {
  buildDeleteRequestCollectionBatch,
  buildRenameRequestCollectionBatch,
} from '@/shared/sync/request-collection-mutations';

export { createRequestCollectionSyncMirror } from '@/context/request-collection-sync-mirror';

export type RequestCollectionSimpleResult = SyncSimpleResult;

export interface RequestCollectionWriteOptions {
  workspaceId: string;
  surfaceId: string;
  batchId?: string;
  mirror?: RequestCollectionSyncMirror;
  context?: RendererContextHandle;
}

function resolveMirror(opts: RequestCollectionWriteOptions): RequestCollectionSyncMirror {
  return opts.mirror ?? getActiveRequestCollectionSyncMirror();
}

function resolveContext(opts: RequestCollectionWriteOptions): RendererContextHandle {
  if (opts.context) return opts.context;
  return ensureRendererContext({ workspaceId: opts.workspaceId, surfaceId: opts.surfaceId });
}

export interface ApplyRequestCollectionRenameInput {
  collectionUid: string;
  name: string;
}

export async function applyRequestCollectionRename(
  input: ApplyRequestCollectionRenameInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const mirror = resolveMirror(opts);
  if (!mirror.getRequestCollectionMirror(input.collectionUid)) {
    return { ok: false, reason: 'not-found' };
  }
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameRequestCollectionBatch(input, ctx));
}

export interface ApplyRequestCollectionDeleteInput {
  collectionUid: string;
}

export async function applyRequestCollectionDelete(
  input: ApplyRequestCollectionDeleteInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const ctx = resolveContext(opts).next(
    opts.batchId
      ? { batchId: opts.batchId }
      : { batchId: `request-collection-delete-${input.collectionUid}` },
  );
  return applySyncPayload({
    batch: buildDeleteRequestCollectionBatch(input.collectionUid, ctx),
    sideEffects: [],
  });
}

export type { MutationEnvelope };
