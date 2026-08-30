/**
 * Renderer-side imperative entry point for request-collection writes.
 *
 * Mirrors `collection-write-client.ts` but routed through the
 * request-collection entity type. Identity for variable rows is
 * `variable.uid`; variables-replacement folds through the shared
 * {@link buildVariablesReplacement} helper.
 */

import { MIN_SCHEMA_VERSION } from '@openheaders/core/schemas';
import {
  type MutationEnvelope,
  REQUEST_COLLECTION_AUTHS_PATH,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_VARS_PATH,
  WORKSPACE_ROOTS_REF,
  WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
} from '@openheaders/core/sync';
import { buildVariablesReplacement } from '@openheaders/core/sync-builders';
import {
  buildDeleteRequestCollectionBatch,
  buildRemoveRequestCollectionVarBatch,
  buildRenameRequestCollectionBatch,
  buildSetRequestCollectionAuthPoolBatch,
  buildSetRequestCollectionPinnedAndDefaultBatch,
  buildSetRequestCollectionScriptsBatch,
  buildSetRequestCollectionSpecLinkBatch,
  buildSetRequestCollectionVarBatch,
  type SetRequestCollectionScriptsInput,
} from '@openheaders/core/sync-builders/mutations/request-collection-mutations';
import { seedRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import type { AuthPoolEntry, Collection, SpecLink, Variable } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import {
  getRequestCollectionSyncMirrorForWorkspace,
  type RequestCollectionSyncMirror,
} from '../../context/mirrors/request-collection-sync-mirror';
import type { RequestFolderSyncMirror } from '../../context/mirrors/request-folder-sync-mirror';
import {
  getWorkspaceRootsSyncMirrorForWorkspace,
  type WorkspaceRootsSyncMirror,
} from '../../context/mirrors/workspace-roots-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';
import {
  applyRequestTreeDescendantDeletes,
  type RequestTreeMirrorOverrides,
  requestTreeDescendants,
} from './tree-descendants';
import { requestTreeMirrors } from './tree-placement';

export { createRequestCollectionSyncMirror } from '../../context/mirrors/request-collection-sync-mirror';

export type RequestCollectionSimpleResult = SyncSimpleResult;

export interface RequestCollectionWriteOptions extends BaseSyncWriteOptions, RequestTreeMirrorOverrides {
  mirror?: RequestCollectionSyncMirror;
  /** The tree's folder mirror — walked by a delete's cascade (test override). */
  folderMirror?: RequestFolderSyncMirror;
  /** Test override for the workspace-roots mirror a create appends after. */
  rootsMirror?: WorkspaceRootsSyncMirror;
}

/**
 * Renderer-direct request-collection create. Mints uid + path locally,
 * builds the seed batch, and fires `oh.sync.apply` against the workspace
 * carried on `opts`. Mirrors `applyCollectionCreate`.
 */
export type RequestCollectionMutationResult =
  | { ok: true; collection: Collection }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface ApplyRequestCollectionCreateInput {
  name: string;
}

export async function applyRequestCollectionCreate(
  input: ApplyRequestCollectionCreateInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionMutationResult> {
  const uid = generateUid();
  const folderName = toFolderName(input.name, uid);
  const collection: Collection = {
    schemaVersion: MIN_SCHEMA_VERSION,
    uid,
    path: `requests/${folderName}`,
    name: input.name,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  const roots = opts.rootsMirror ?? getWorkspaceRootsSyncMirrorForWorkspace(opts.workspaceId);
  await roots.hydrated;
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const ack = await applySyncPayload({
    batch: seedRequestCollection(collection, ctx, {
      parent: WORKSPACE_ROOTS_REF,
      orderKey: roots.appendOrderKey(WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH),
    }),
    sideEffects: [],
  });
  if (ack.ok) return { ok: true, collection };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export interface ApplyRequestCollectionRenameInput {
  collectionUid: string;
  name: string;
}

export async function applyRequestCollectionRename(
  input: ApplyRequestCollectionRenameInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const mirror = resolveMirror(opts, getRequestCollectionSyncMirrorForWorkspace);
  if (!mirror.getRequestCollectionMirror(input.collectionUid)) {
    return { ok: false, reason: 'not-found' };
  }
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameRequestCollectionBatch(input, ctx));
}

export interface ApplyRequestCollectionSetPinnedAndDefaultInput {
  collectionUid: string;
  pinnedEnvironmentIds: readonly string[];
  defaultEnvironmentId: string | null;
}

/** Persist the env-selector's pinned + default picks on a request
 *  collection. Mirrors `applySetPinnedAndDefault` (rule side). */
export async function applyRequestCollectionSetPinnedAndDefault(
  input: ApplyRequestCollectionSetPinnedAndDefaultInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next({
    batchId: opts.batchId ?? `req-coll-pinned-${input.collectionUid}`,
  });
  return applySyncPayload(buildSetRequestCollectionPinnedAndDefaultBatch(input, ctx));
}

export type ApplyRequestCollectionSetScriptsInput = SetRequestCollectionScriptsInput;

/** Persist the collection's ancestor script slots (both in one batch).
 *  `value: undefined` clears a slot — field absent ↔ no script. */
export async function applyRequestCollectionSetScripts(
  input: ApplyRequestCollectionSetScriptsInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const mirror = resolveMirror(opts, getRequestCollectionSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getRequestCollectionMirror(input.collectionUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next({
    batchId: opts.batchId ?? `request-collection-scripts-${input.collectionUid}`,
  });
  return applySyncPayload(buildSetRequestCollectionScriptsBatch(input, ctx));
}

export interface ApplyRequestCollectionSetAuthPoolInput {
  collectionUid: string;
  /** The whole pool; empty with no default = the level goes transparent. */
  auths: readonly AuthPoolEntry[];
  defaultAuthUid: string | undefined;
}

/** Persist the collection's auth pool — the set diff over the entries
 *  plus the default scalar, the pre-pool `auth` field retired in the
 *  same batch. The diff baseline is the mirror's live collection. */
export async function applyRequestCollectionSetAuthPool(
  input: ApplyRequestCollectionSetAuthPoolInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const mirror = resolveMirror(opts, getRequestCollectionSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getRequestCollectionMirror(input.collectionUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const currentKeys = new Map(
    mirror
      .liveOrderedSetItems(input.collectionUid, REQUEST_COLLECTION_AUTHS_PATH)
      .map((e) => [e.itemId, e.orderKey] as const),
  );
  const ctx = resolveRendererContext(opts).next({
    batchId: opts.batchId ?? `request-collection-auth-${input.collectionUid}`,
  });
  const payload = buildSetRequestCollectionAuthPoolBatch(
    {
      collectionUid: input.collectionUid,
      auths: input.auths,
      defaultAuthUid: input.defaultAuthUid,
      current: entry.collection,
      currentKeys,
    },
    ctx,
  );
  if (payload.batch.mutations.length === 0) return { ok: true };
  return applySyncPayload(payload);
}

export interface ApplyRequestCollectionSetSpecLinkInput {
  collectionUid: string;
  /** New generation bookkeeping; `undefined` clears the link. */
  specLink: SpecLink | undefined;
}

/** Persist the collection's spec generation bookkeeping — written once
 *  right after a Generate Collection run lands its entities. */
export async function applyRequestCollectionSetSpecLink(
  input: ApplyRequestCollectionSetSpecLinkInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const mirror = resolveMirror(opts, getRequestCollectionSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getRequestCollectionMirror(input.collectionUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next({
    batchId: opts.batchId ?? `request-collection-spec-link-${input.collectionUid}`,
  });
  return applySyncPayload(buildSetRequestCollectionSpecLinkBatch(input, ctx));
}

export interface ApplyRequestCollectionDeleteInput {
  collectionUid: string;
}

/**
 * Delete a request-collection and everything under it. The cascade
 * walks the parent-owned sets (`tree-descendants.ts`) — every request
 * kind, folders deepest-first — and tombstones each on its own batch
 * before the collection's own; mirrors the SW store's
 * `deleteRequestCollection` so the gesture lands the same from either
 * surface, and the collection's tombstone arriving last keeps the
 * sidebar from ever showing an orphan with its parent gone.
 */
export async function applyRequestCollectionDelete(
  input: ApplyRequestCollectionDeleteInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const collectionMirror = resolveMirror(opts, getRequestCollectionSyncMirrorForWorkspace);
  await collectionMirror.hydrated;
  if (!collectionMirror.getRequestCollectionMirror(input.collectionUid)) return { ok: false, reason: 'not-found' };

  const tree = requestTreeMirrors(opts.workspaceId, { collectionMirror, folderMirror: opts.folderMirror });
  const descendants = await requestTreeDescendants(tree, opts.workspaceId, opts, {
    type: REQUEST_COLLECTION_ENTITY_TYPE,
    uid: input.collectionUid,
  });
  const baseCtx = resolveRendererContext(opts);
  const cascade = await applyRequestTreeDescendantDeletes(descendants, baseCtx, 'request-collection-delete-cascade');
  if (!cascade.ok) return cascade;

  const ctx = baseCtx.next(
    opts.batchId ? { batchId: opts.batchId } : { batchId: `request-collection-delete-${input.collectionUid}` },
  );
  return applySyncPayload(buildDeleteRequestCollectionBatch(input.collectionUid, ctx));
}

export interface ApplyRequestCollectionSetVarInput {
  requestCollectionUid: string;
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
}

export async function applyRequestCollectionSetVar(
  input: ApplyRequestCollectionSetVarInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetRequestCollectionVarBatch(input, ctx));
}

export interface ApplyRequestCollectionRemoveVarInput {
  requestCollectionUid: string;
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export async function applyRequestCollectionRemoveVar(
  input: ApplyRequestCollectionRemoveVarInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRemoveRequestCollectionVarBatch(input, ctx));
}

/**
 * Editor convenience: persist a complete variables list keyed by uid.
 * Diff shape lives in {@link buildVariablesReplacement}; empty input →
 * `{ ok: true }` short-circuit.
 */
export async function applyRequestCollectionVariablesReplacement(
  collectionUid: string,
  newVars: readonly Variable[],
  oldVars: readonly Variable[],
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  // Current persisted vars order keys — the shared builder reuses them to
  // keep unmoved rows byte-stable and persist row order (§23.5).
  const mirror = resolveMirror(opts, getRequestCollectionSyncMirrorForWorkspace);
  await mirror.hydrated;
  const currentKeys = new Map(
    mirror.liveOrderedSetItems(collectionUid, REQUEST_COLLECTION_VARS_PATH).map((e) => [e.itemId, e.orderKey] as const),
  );
  const ctx = resolveRendererContext(opts).next({
    batchId: opts.batchId ?? `request-collection-vars-replace-${collectionUid}`,
  });
  const payload = buildVariablesReplacement(
    {
      entityType: REQUEST_COLLECTION_ENTITY_TYPE,
      varsPath: REQUEST_COLLECTION_VARS_PATH,
    },
    ctx,
    { entityUid: collectionUid, newVars, oldVars, currentKeys },
  );
  if (!payload) return { ok: true };
  return applySyncPayload(payload);
}

export type { MutationEnvelope };
