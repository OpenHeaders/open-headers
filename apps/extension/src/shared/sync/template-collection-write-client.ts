/**
 * Renderer-side imperative entry point for template-collection writes.
 *
 * Mirrors `request-collection-write-client.ts`. Variables-replacement
 * folds through the shared {@link buildVariablesReplacement} helper.
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
  type VariableType,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import {
  getActiveTemplateCollectionSyncMirror,
  type TemplateCollectionSyncMirror,
} from '@/context/template-collection-sync-mirror';
import {
  buildDeleteTemplateCollectionBatch,
  buildRemoveTemplateCollectionVarBatch,
  buildRenameTemplateCollectionBatch,
  buildRenameTemplateCollectionVarBatch,
  buildSetTemplateCollectionVarBatch,
  buildSetTemplateCollectionVarTypeBatch,
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
  const mirror = resolveMirror(opts, getActiveTemplateCollectionSyncMirror);
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
  name: string;
  value: string;
  type?: VariableType;
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
  name: string;
}

export async function applyTemplateCollectionRemoveVar(
  input: ApplyTemplateCollectionRemoveVarInput,
  opts: TemplateCollectionWriteOptions,
): Promise<TemplateCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRemoveTemplateCollectionVarBatch(input, ctx));
}

export interface ApplyTemplateCollectionRenameVarInput {
  templateCollectionUid: string;
  oldName: string;
  newName: string;
  value: string;
  type?: VariableType;
}

export async function applyTemplateCollectionRenameVar(
  input: ApplyTemplateCollectionRenameVarInput,
  opts: TemplateCollectionWriteOptions,
): Promise<TemplateCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameTemplateCollectionVarBatch(input, ctx));
}

export interface ApplyTemplateCollectionSetVarTypeInput {
  templateCollectionUid: string;
  name: string;
  value: string;
  type: VariableType;
}

export async function applyTemplateCollectionSetVarType(
  input: ApplyTemplateCollectionSetVarTypeInput,
  opts: TemplateCollectionWriteOptions,
): Promise<TemplateCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetTemplateCollectionVarTypeBatch(input, ctx));
}

/**
 * Editor convenience: persist a complete variables list. Adds + value/
 * type changes emit `addToSet`; deletions emit `removeFromSet`. Diff
 * shape lives in {@link buildVariablesReplacement} (shared across
 * per-uid variable scopes); empty input → `{ ok: true }` short-circuit.
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
