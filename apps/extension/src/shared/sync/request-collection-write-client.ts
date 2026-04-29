/**
 * Renderer-side imperative entry point for request-collection writes.
 *
 * Mirrors `collection-write-client.ts` but routed through the
 * request-collection entity type. Catalog ships rename-only at v1.
 */

import { type MutationEnvelope } from '@openheaders/core/sync';
import { call } from '@utils/bridge';
import {
  getActiveRequestCollectionSyncMirror,
  type RequestCollectionSyncMirror,
} from '@/context/request-collection-sync-mirror';
import {
  ensureRendererContext,
  type RendererContextHandle,
} from '@/context/rule-mutator-context';
import {
  buildDeleteRequestCollectionBatch,
  buildRenameRequestCollectionBatch,
  type RequestCollectionMutationPayload,
} from '@/shared/sync/request-collection-mutations';

export { createRequestCollectionSyncMirror } from '@/context/request-collection-sync-mirror';

export type RequestCollectionSimpleResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

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

async function applyPayload(
  payload: RequestCollectionMutationPayload,
): Promise<RequestCollectionSimpleResult> {
  if (payload.batch.mutations.length === 0) return { ok: true };
  try {
    const resp = await call('oh.sync.apply', {
      batch: payload.batch,
      sideEffects: payload.sideEffects,
    });
    if (resp.ok) return { ok: true };
    return { ok: false, reason: 'other', message: resp.failure?.detail };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return { ok: false, reason: 'other', message };
  }
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
  return applyPayload(buildRenameRequestCollectionBatch(input, ctx));
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
  return applyPayload({
    batch: buildDeleteRequestCollectionBatch(input.collectionUid, ctx),
    sideEffects: [],
  });
}

export type { MutationEnvelope };
