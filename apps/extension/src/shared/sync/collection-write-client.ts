/**
 * Renderer-side imperative entry point for Collection writes.
 *
 * Mirrors `env-write-client.ts`. Every helper builds a
 * `MutationBatch` against the active collection mirror and fires
 * `oh.sync.apply` directly — no SW round-trip per primitive, no
 * `updateCollectionVariables` shim. The §19.4 synchronous-render
 * discipline lives in the editor; this module is what the editor
 * reaches for once the user commits.
 *
 * Identity for variable rows is `variable.uid`. `applyCollectionSetVar`
 * upserts the whole record (handles add, edit, rename, type-toggle
 * uniformly); `applyCollectionRemoveVar` keys by uid;
 * `applyCollectionVariablesReplacement` diffs two lists by uid via the
 * shared helper.
 */

import { MIN_SCHEMA_VERSION } from '@openheaders/core/schemas';
import type { MutationEnvelope } from '@openheaders/core/sync';
import {
  COLLECTION_ENTITY_TYPE,
  COLLECTION_VARS_PATH,
  collectionInvalidateResolverIntent,
} from '@openheaders/core/sync';
import type { Collection, Variable } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import {
  type CollectionSyncMirror,
  getCollectionSyncMirrorForWorkspace,
} from '@/context/collection-sync-mirror';
import { getFolderSyncMirrorForWorkspace } from '@/context/folder-sync-mirror';
import { getRuleSyncMirrorForWorkspace } from '@/context/rule-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from '@/shared/sync/apply-payload';
import {
  buildDeleteCollectionBatch,
  buildRemoveCollectionVarBatch,
  buildRenameCollectionBatch,
  buildSetCollectionVarBatch,
  buildSetDefaultEnvironmentIdBatch,
  buildSetPinnedAndDefaultBatch,
  buildSetPinnedEnvironmentsBatch,
} from '@openheaders/core/sync-builders/collection-mutations';
import { seedCollection } from '@openheaders/core/sync-builders/collection-projection';
import { buildDeleteFolderEntityBatch } from '@openheaders/core/sync-builders/folder-mutations';
import { buildDeleteBatch as buildDeleteRuleBatch } from '@openheaders/core/sync-builders/rule-mutations';
import { buildVariablesReplacement } from '@openheaders/core/sync-builders';

export { createCollectionSyncMirror } from '@/context/collection-sync-mirror';

export type CollectionSimpleResult = SyncSimpleResult;

export interface CollectionWriteOptions extends BaseSyncWriteOptions {
  mirror?: CollectionSyncMirror;
}

export interface ApplyCollectionSetVarInput {
  collectionUid: string;
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
}

export async function applyCollectionSetVar(
  input: ApplyCollectionSetVarInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetCollectionVarBatch(input, ctx));
}

export interface ApplyCollectionRemoveVarInput {
  collectionUid: string;
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export async function applyCollectionRemoveVar(
  input: ApplyCollectionRemoveVarInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRemoveCollectionVarBatch(input, ctx));
}

/**
 * Renderer-direct collection create. Mints uid + path locally, builds the
 * seed batch (one `create` for the scalar shell + one `addToSet` per
 * variable), and fires `oh.sync.apply` against the workspace carried on
 * `opts`. Mirrors `applyEnvironmentCreate`. The legacy SW handler
 * (`createLocalCollection`) operates on the runtime-Active workspace and
 * is bypassed here — workbench surfaces emit applies with the
 * editing-scope workspaceId.
 */
export type CollectionMutationResult =
  | { ok: true; collection: Collection }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface ApplyCollectionCreateInput {
  name: string;
}

export async function applyCollectionCreate(
  input: ApplyCollectionCreateInput,
  opts: CollectionWriteOptions,
): Promise<CollectionMutationResult> {
  const uid = generateUid();
  const folderName = toFolderName(input.name, uid);
  const collection: Collection = {
    schemaVersion: MIN_SCHEMA_VERSION,
    uid,
    path: `rules/${folderName}`,
    name: input.name,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const ack = await applySyncPayload({ batch: seedCollection(collection, ctx), sideEffects: [] });
  if (ack.ok) return { ok: true, collection };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export interface ApplyCollectionDeleteInput {
  collectionUid: string;
}

/**
 * Delete a (rules) collection and cascade-delete every descendant rule
 * + folder. Mirrors `rule-store.deleteCollection` (legacy SW handler)
 * so cascade is consistent across surfaces.
 */
export async function applyCollectionDelete(
  input: ApplyCollectionDeleteInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const collectionMirror = resolveMirror(opts, getCollectionSyncMirrorForWorkspace);
  await collectionMirror.hydrated;
  const collectionEntry = collectionMirror.getCollectionMirror(input.collectionUid);
  if (!collectionEntry) return { ok: false, reason: 'not-found' };
  const childPathPrefix = `${collectionEntry.collection.path}/`;

  const ruleMirror = getRuleSyncMirrorForWorkspace(opts.workspaceId);
  const folderMirror = getFolderSyncMirrorForWorkspace(opts.workspaceId);
  await Promise.all([ruleMirror.hydrated, folderMirror.hydrated]);

  const cascadingRuleUids = ruleMirror
    .listRules()
    .filter((r) => r.path?.startsWith(childPathPrefix))
    .map((r) => r.uid);
  const cascadingFolderUids = folderMirror
    .listFolders()
    .filter((f) => f.path.startsWith(childPathPrefix))
    .map((f) => f.uid);

  const baseCtx = resolveRendererContext(opts);
  for (const ruleUid of cascadingRuleUids) {
    const ctx = baseCtx.next({ batchId: `collection-delete-cascade-rule-${ruleUid}` });
    const ack = await applySyncPayload(buildDeleteRuleBatch(ruleUid, ctx));
    if (!ack.ok) return ack;
  }
  for (const folderUid of cascadingFolderUids) {
    const ctx = baseCtx.next({ batchId: `collection-delete-cascade-folder-${folderUid}` });
    const ack = await applySyncPayload({
      batch: buildDeleteFolderEntityBatch(folderUid, ctx),
      sideEffects: [],
    });
    if (!ack.ok) return ack;
  }

  const ctx = baseCtx.next(
    opts.batchId ? { batchId: opts.batchId } : { batchId: `collection-delete-${input.collectionUid}` },
  );
  return applySyncPayload({
    batch: buildDeleteCollectionBatch(input.collectionUid, ctx),
    sideEffects: [],
  });
}

export interface ApplyRenameCollectionInput {
  collectionUid: string;
  name: string;
}

export async function applyRenameCollection(
  input: ApplyRenameCollectionInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameCollectionBatch(input, ctx));
}

export interface ApplySetPinnedEnvironmentsInput {
  collectionUid: string;
  pinnedEnvironmentIds: readonly string[];
}

export async function applySetPinnedEnvironments(
  input: ApplySetPinnedEnvironmentsInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetPinnedEnvironmentsBatch(input, ctx));
}

export interface ApplySetDefaultEnvironmentIdInput {
  collectionUid: string;
  defaultEnvironmentId: string | null;
}

export async function applySetDefaultEnvironmentId(
  input: ApplySetDefaultEnvironmentIdInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetDefaultEnvironmentIdBatch(input, ctx));
}

export interface ApplySetPinnedAndDefaultInput {
  collectionUid: string;
  pinnedEnvironmentIds: readonly string[];
  defaultEnvironmentId: string | null;
}

export async function applySetPinnedAndDefault(
  input: ApplySetPinnedAndDefaultInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next({
    batchId: opts.batchId ?? `coll-pinned-${input.collectionUid}`,
  });
  return applySyncPayload(buildSetPinnedAndDefaultBatch(input, ctx));
}

/**
 * Editor convenience: persist a complete variables list keyed by uid.
 * Diff shape lives in {@link buildVariablesReplacement}; empty input →
 * `{ ok: true }` short-circuit without firing.
 */
export async function applyCollectionVariablesReplacement(
  collectionUid: string,
  newVars: readonly Variable[],
  oldVars: readonly Variable[],
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next({ batchId: opts.batchId ?? `coll-replace-${collectionUid}` });
  const payload = buildVariablesReplacement(
    {
      entityType: COLLECTION_ENTITY_TYPE,
      varsPath: COLLECTION_VARS_PATH,
      makeSideEffects: (uid, hlc) => [collectionInvalidateResolverIntent(uid, hlc)],
    },
    ctx,
    { entityUid: collectionUid, newVars, oldVars },
  );
  if (!payload) return { ok: true };
  return applySyncPayload(payload);
}

export type { MutationEnvelope };
