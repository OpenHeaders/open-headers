/**
 * Renderer-side imperative entry point for template-collection writes.
 *
 * Mirrors `request-collection-write-client.ts`. Identity for variable
 * rows is `variable.uid`; variables-replacement folds through the
 * shared {@link buildVariablesReplacement} helper.
 */

import { MIN_SCHEMA_VERSION } from '@openheaders/core/schemas';
import {
  type MutationEnvelope,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_COLLECTION_VARS_PATH,
  templateCollectionInvalidateResolverIntent,
} from '@openheaders/core/sync';
import type { Collection, Variable } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import {
  getTemplateCollectionSyncMirrorForWorkspace,
  type TemplateCollectionSyncMirror,
} from '@/context/template-collection-sync-mirror';
import { getTemplateFolderSyncMirrorForWorkspace } from '@/context/template-folder-sync-mirror';
import { getTemplateSyncMirrorForWorkspace } from '@/context/template-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from '@/shared/sync/apply-payload';
import {
  buildDeleteTemplateCollectionBatch,
  buildRemoveTemplateCollectionVarBatch,
  buildRenameTemplateCollectionBatch,
  buildSetTemplateCollectionVarBatch,
} from '@openheaders/core/sync-builders/template-collection-mutations';
import { seedTemplateCollection } from '@openheaders/core/sync-builders/template-collection-projection';
import { buildDeleteTemplateFolderEntityBatch } from '@openheaders/core/sync-builders/template-folder-mutations';
import { buildDeleteBatch as buildDeleteTemplateBatch } from '@openheaders/core/sync-builders/template-mutations';
import { buildVariablesReplacement } from '@openheaders/core/sync-builders';

export { createTemplateCollectionSyncMirror } from '@/context/template-collection-sync-mirror';

export type TemplateCollectionSimpleResult = SyncSimpleResult;

export interface TemplateCollectionWriteOptions extends BaseSyncWriteOptions {
  mirror?: TemplateCollectionSyncMirror;
}

/**
 * Renderer-direct template-collection create. Mints uid + path locally,
 * builds the seed batch, and fires `oh.sync.apply` against the workspace
 * carried on `opts`. Mirrors `applyCollectionCreate`.
 */
export type TemplateCollectionMutationResult =
  | { ok: true; collection: Collection }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface ApplyTemplateCollectionCreateInput {
  name: string;
}

export async function applyTemplateCollectionCreate(
  input: ApplyTemplateCollectionCreateInput,
  opts: TemplateCollectionWriteOptions,
): Promise<TemplateCollectionMutationResult> {
  const uid = generateUid();
  const folderName = toFolderName(input.name, uid);
  const collection: Collection = {
    schemaVersion: MIN_SCHEMA_VERSION,
    uid,
    path: `templates/${folderName}`,
    name: input.name,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const ack = await applySyncPayload({ batch: seedTemplateCollection(collection, ctx), sideEffects: [] });
  if (ack.ok) return { ok: true, collection };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
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

/**
 * Delete a template-collection and cascade-delete every descendant
 * template + template-folder. Mirrors `template-store.deleteTemplateCollection`
 * (legacy SW handler) so cascade is consistent across surfaces.
 */
export async function applyTemplateCollectionDelete(
  input: ApplyTemplateCollectionDeleteInput,
  opts: TemplateCollectionWriteOptions,
): Promise<TemplateCollectionSimpleResult> {
  const collectionMirror = resolveMirror(opts, getTemplateCollectionSyncMirrorForWorkspace);
  await collectionMirror.hydrated;
  const collectionEntry = collectionMirror.getTemplateCollectionMirror(input.collectionUid);
  if (!collectionEntry) return { ok: false, reason: 'not-found' };
  const childPathPrefix = `${collectionEntry.collection.path}/`;

  const templateMirror = getTemplateSyncMirrorForWorkspace(opts.workspaceId);
  const templateFolderMirror = getTemplateFolderSyncMirrorForWorkspace(opts.workspaceId);
  await Promise.all([templateMirror.hydrated, templateFolderMirror.hydrated]);

  const cascadingTemplateUids = templateMirror
    .listTemplates()
    .filter((t) => t.path?.startsWith(childPathPrefix))
    .map((t) => t.uid);
  const cascadingFolderUids = templateFolderMirror
    .listTemplateFolders()
    .filter((f) => f.path.startsWith(childPathPrefix))
    .map((f) => f.uid);

  const baseCtx = resolveRendererContext(opts);
  for (const tplUid of cascadingTemplateUids) {
    const ctx = baseCtx.next({ batchId: `template-collection-delete-cascade-tpl-${tplUid}` });
    const ack = await applySyncPayload(buildDeleteTemplateBatch(tplUid, ctx));
    if (!ack.ok) return ack;
  }
  for (const folderUid of cascadingFolderUids) {
    const ctx = baseCtx.next({ batchId: `template-collection-delete-cascade-folder-${folderUid}` });
    const ack = await applySyncPayload({
      batch: buildDeleteTemplateFolderEntityBatch(folderUid, ctx),
      sideEffects: [],
    });
    if (!ack.ok) return ack;
  }

  const ctx = baseCtx.next(
    opts.batchId ? { batchId: opts.batchId } : { batchId: `template-collection-delete-${input.collectionUid}` },
  );
  return applySyncPayload({
    batch: buildDeleteTemplateCollectionBatch(input.collectionUid, ctx),
    sideEffects: [],
  });
}

export interface ApplyTemplateCollectionSetVarInput {
  templateCollectionUid: string;
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
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
  newVars: readonly Variable[],
  oldVars: readonly Variable[],
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
