/**
 * Renderer-side imperative entry point for template-collection writes.
 *
 * Mirrors `request-collection-write-client.ts`. Catalog ships rename +
 * delete at v1; create still flows through the SW seam because there's
 * no renderer-direct create gesture today.
 */

import { type MutationEnvelope } from '@openheaders/core/sync';
import { call } from '@utils/bridge';
import {
  getActiveTemplateCollectionSyncMirror,
  type TemplateCollectionSyncMirror,
} from '@/context/template-collection-sync-mirror';
import {
  ensureRendererContext,
  type RendererContextHandle,
} from '@/context/rule-mutator-context';
import {
  buildDeleteTemplateCollectionBatch,
  buildRenameTemplateCollectionBatch,
  type TemplateCollectionMutationPayload,
} from '@/shared/sync/template-collection-mutations';

export { createTemplateCollectionSyncMirror } from '@/context/template-collection-sync-mirror';

export type TemplateCollectionSimpleResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface TemplateCollectionWriteOptions {
  workspaceId: string;
  surfaceId: string;
  batchId?: string;
  mirror?: TemplateCollectionSyncMirror;
  context?: RendererContextHandle;
}

function resolveMirror(opts: TemplateCollectionWriteOptions): TemplateCollectionSyncMirror {
  return opts.mirror ?? getActiveTemplateCollectionSyncMirror();
}

function resolveContext(opts: TemplateCollectionWriteOptions): RendererContextHandle {
  if (opts.context) return opts.context;
  return ensureRendererContext({ workspaceId: opts.workspaceId, surfaceId: opts.surfaceId });
}

async function applyPayload(
  payload: TemplateCollectionMutationPayload,
): Promise<TemplateCollectionSimpleResult> {
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

export interface ApplyTemplateCollectionRenameInput {
  collectionUid: string;
  name: string;
}

export async function applyTemplateCollectionRename(
  input: ApplyTemplateCollectionRenameInput,
  opts: TemplateCollectionWriteOptions,
): Promise<TemplateCollectionSimpleResult> {
  const mirror = resolveMirror(opts);
  if (!mirror.getTemplateCollectionMirror(input.collectionUid)) {
    return { ok: false, reason: 'not-found' };
  }
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applyPayload(buildRenameTemplateCollectionBatch(input, ctx));
}

export interface ApplyTemplateCollectionDeleteInput {
  collectionUid: string;
}

export async function applyTemplateCollectionDelete(
  input: ApplyTemplateCollectionDeleteInput,
  opts: TemplateCollectionWriteOptions,
): Promise<TemplateCollectionSimpleResult> {
  const ctx = resolveContext(opts).next(
    opts.batchId
      ? { batchId: opts.batchId }
      : { batchId: `template-collection-delete-${input.collectionUid}` },
  );
  return applyPayload({
    batch: buildDeleteTemplateCollectionBatch(input.collectionUid, ctx),
    sideEffects: [],
  });
}

export type { MutationEnvelope };
