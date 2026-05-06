/**
 * Renderer-side imperative entry point for template-collection writes.
 *
 * Mirrors `request-collection-write-client.ts`. Identity for variable
 * rows is `variable.uid`; variables-replacement folds through the
 * shared {@link buildVariablesReplacement} helper.
 */

import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from '@/shared/sync/apply-payload';
import { type MutationEnvelope } from '@openheaders/core/sync';
import {
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_COLLECTION_VARS_PATH,
  templateCollectionInvalidateResolverIntent,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import {
  getTemplateCollectionSyncMirrorForWorkspace,
  type TemplateCollectionSyncMirror,
} from '@/context/template-collection-sync-mirror';
import {
  buildDeleteTemplateCollectionBatch,
  buildRemoveTemplateCollectionVarBatch,
  buildRenameTemplateCollectionBatch,
  buildSetTemplateCollectionVarBatch,
} from '@/shared/sync/template-collection-mutations';
import { buildVariablesReplacement } from '@/shared/sync/variables-replacement';

export { createTemplateCollectionSyncMirror } from '@/context/template-collection-sync-mirror';

export type TemplateCollectionSimpleResult = SyncSimpleResult;

export interface TemplateCollectionWriteOptions extends BaseSyncWriteOptions {
  mirror?: TemplateCollectionSyncMirror;
}

export interface ApplyTemplateCollectionRenameInput {
  collectionUid: string;
  name: string;
}

export async function applyTemplateCollectionRename(
  input: ApplyTemplateCollectionRenameInput,
  opts: TemplateCollectionWriteOptions,
): Promise<TemplateCollectionSimpleResult> {
  const mirror = resolveMirror(opts, getTemplateCollectionSyncMirrorForWorkspace);
  if (!mirror.getTemplateCollectionMirror(input.collectionUid)) {
    return { ok: false, reason: 'not-found' };
  }
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameTemplateCollectionBatch(input, ctx));
}

export interface ApplyTemplateCollectionDeleteInput {
  collectionUid: string;
}

export async function applyTemplateCollectionDelete(
  input: ApplyTemplateCollectionDeleteInput,
  opts: TemplateCollectionWriteOptions,
): Promise<TemplateCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(
    opts.batchId
      ? { batchId: opts.batchId }
      : { batchId: `template-collection-delete-${input.collectionUid}` },
  );
  return applySyncPayload({
    batch: buildDeleteTemplateCollectionBatch(input.collectionUid, ctx),
    sideEffects: [],
  });
}

export interface ApplyTemplateCollectionSetVarInput {
  templateCollectionUid: string;
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: V5.Variable;
}

export async function applyTemplateCollectionSetVar(
  input: ApplyTemplateCollectionSetVarInput,
  opts: TemplateCollectionWriteOptions,
): Promise<TemplateCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetTemplateCollectionVarBatch(input, ctx));
}

export interface ApplyTemplateCollectionRemoveVarInput {
  templateCollectionUid: string;
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export async function applyTemplateCollectionRemoveVar(
  input: ApplyTemplateCollectionRemoveVarInput,
  opts: TemplateCollectionWriteOptions,
): Promise<TemplateCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRemoveTemplateCollectionVarBatch(input, ctx));
}

/**
 * Editor convenience: persist a complete variables list keyed by uid.
 * Diff shape lives in {@link buildVariablesReplacement}; empty input →
 * `{ ok: true }` short-circuit.
 */
export async function applyTemplateCollectionVariablesReplacement(
  collectionUid: string,
  newVars: readonly V5.Variable[],
  oldVars: readonly V5.Variable[],
  opts: TemplateCollectionWriteOptions,
): Promise<TemplateCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next({
    batchId: opts.batchId ?? `template-collection-vars-replace-${collectionUid}`,
  });
  const payload = buildVariablesReplacement(
    {
      entityType: TEMPLATE_COLLECTION_ENTITY_TYPE,
      varsPath: TEMPLATE_COLLECTION_VARS_PATH,
      makeSideEffects: (uid, hlc) => [templateCollectionInvalidateResolverIntent(uid, hlc)],
    },
    ctx,
    { entityUid: collectionUid, newVars, oldVars },
  );
  if (!payload) return { ok: true };
  return applySyncPayload(payload);
}

export type { MutationEnvelope };
