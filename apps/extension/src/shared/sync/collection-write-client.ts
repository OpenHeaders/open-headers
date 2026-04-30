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
 * `applyCollectionVariablesReplacement` is the editor convenience:
 * take the editor's pre-image (`oldVars`) + post-image (`newVars`)
 * and fold them into the catalog primitives — diff is `setCollectionVar`
 * for adds/changes and `removeCollectionVar` for deletions, all
 * bundled under one `batchId`.
 */

import type { V5 } from '@openheaders/core/types';
import { mintBatch, type MutationBody, type MutationEnvelope, type SideEffectIntent } from '@openheaders/core/sync';
import {
  COLLECTION_ENTITY_TYPE,
  COLLECTION_VARS_PATH,
  collectionInvalidateResolverIntent,
  type VariableType,
} from '@openheaders/core/sync';
import { call } from '@utils/bridge';
import {
  type CollectionSyncMirror,
  createCollectionSyncMirror,
  getActiveCollectionSyncMirror,
} from '@/context/collection-sync-mirror';
import {
  ensureRendererContext,
  type RendererContextHandle,
} from '@/context/renderer-mutator-context';
import {
  buildRemoveCollectionVarBatch,
  buildRenameCollectionBatch,
  buildRenameCollectionVarBatch,
  buildSetCollectionVarBatch,
  buildSetCollectionVarTypeBatch,
  buildSetDefaultEnvironmentIdBatch,
  buildSetPinnedAndDefaultBatch,
  buildSetPinnedEnvironmentsBatch,
  type CollectionMutationPayload,
} from '@/shared/sync/collection-mutations';

export { createCollectionSyncMirror } from '@/context/collection-sync-mirror';

export type CollectionSimpleResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface CollectionWriteOptions {
  workspaceId: string;
  surfaceId: string;
  batchId?: string;
  mirror?: CollectionSyncMirror;
  context?: RendererContextHandle;
}

function resolveMirror(opts: CollectionWriteOptions): CollectionSyncMirror {
  return opts.mirror ?? getActiveCollectionSyncMirror();
}

function resolveContext(opts: CollectionWriteOptions): RendererContextHandle {
  if (opts.context) return opts.context;
  return ensureRendererContext({ workspaceId: opts.workspaceId, surfaceId: opts.surfaceId });
}

async function applyPayload(payload: CollectionMutationPayload): Promise<CollectionSimpleResult> {
  if (payload.batch.mutations.length === 0) return { ok: true };
  try {
    const resp = await call('oh.sync.apply', { batch: payload.batch, sideEffects: payload.sideEffects });
    if (resp.ok) return { ok: true };
    return { ok: false, reason: 'other', message: resp.failure?.detail };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return { ok: false, reason: 'other', message };
  }
}

export interface ApplyCollectionSetVarInput {
  collectionUid: string;
  name: string;
  value: string;
  type?: VariableType;
}

export async function applyCollectionSetVar(
  input: ApplyCollectionSetVarInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applyPayload(buildSetCollectionVarBatch(input, ctx));
}

export interface ApplyCollectionRemoveVarInput {
  collectionUid: string;
  name: string;
}

export async function applyCollectionRemoveVar(
  input: ApplyCollectionRemoveVarInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applyPayload(buildRemoveCollectionVarBatch(input, ctx));
}

export interface ApplyCollectionRenameVarInput {
  collectionUid: string;
  oldName: string;
  newName: string;
  value: string;
  type?: VariableType;
}

export async function applyCollectionRenameVar(
  input: ApplyCollectionRenameVarInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applyPayload(buildRenameCollectionVarBatch(input, ctx));
}

export interface ApplyCollectionSetVarTypeInput {
  collectionUid: string;
  name: string;
  value: string;
  type: VariableType;
}

export async function applyCollectionSetVarType(
  input: ApplyCollectionSetVarTypeInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applyPayload(buildSetCollectionVarTypeBatch(input, ctx));
}

export interface ApplyRenameCollectionInput {
  collectionUid: string;
  name: string;
}

export async function applyRenameCollection(
  input: ApplyRenameCollectionInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applyPayload(buildRenameCollectionBatch(input, ctx));
}

export interface ApplySetPinnedEnvironmentsInput {
  collectionUid: string;
  pinnedEnvironmentIds: readonly string[];
}

export async function applySetPinnedEnvironments(
  input: ApplySetPinnedEnvironmentsInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applyPayload(buildSetPinnedEnvironmentsBatch(input, ctx));
}

export interface ApplySetDefaultEnvironmentIdInput {
  collectionUid: string;
  defaultEnvironmentId: string | null;
}

export async function applySetDefaultEnvironmentId(
  input: ApplySetDefaultEnvironmentIdInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applyPayload(buildSetDefaultEnvironmentIdBatch(input, ctx));
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
  const ctx = resolveContext(opts).next({
    batchId: opts.batchId ?? `coll-pinned-${input.collectionUid}`,
  });
  return applyPayload(buildSetPinnedAndDefaultBatch(input, ctx));
}

/**
 * Editor convenience: persist a complete variables list. Adds + value/
 * type changes emit `setCollectionVar`; deletions emit `removeCollectionVar`.
 * Empty input → empty batch.
 */
export async function applyCollectionVariablesReplacement(
  collectionUid: string,
  newVars: readonly V5.Variable[],
  oldVars: readonly V5.Variable[],
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const oldByName = new Map<string, V5.Variable>();
  for (const v of oldVars) oldByName.set(v.name, v);
  const newByName = new Map<string, V5.Variable>();
  for (const v of newVars) {
    if (!v.name.trim()) continue;
    newByName.set(v.name, v);
  }

  const ctx = resolveContext(opts).next({ batchId: opts.batchId ?? `coll-replace-${collectionUid}` });

  const bodies: MutationBody[] = [];
  for (const [name] of oldByName) {
    if (newByName.has(name)) continue;
    bodies.push({
      kind: 'removeFromSet',
      type: COLLECTION_ENTITY_TYPE,
      id: collectionUid,
      path: COLLECTION_VARS_PATH,
      itemId: name,
    });
  }
  for (const [name, variable] of newByName) {
    const prev = oldByName.get(name);
    if (
      prev &&
      prev.value === variable.value &&
      (prev.type ?? 'default') === (variable.type ?? 'default')
    ) {
      continue;
    }
    bodies.push({
      kind: 'addToSet',
      type: COLLECTION_ENTITY_TYPE,
      id: collectionUid,
      path: COLLECTION_VARS_PATH,
      itemId: name,
      item: { name, value: variable.value, type: variable.type ?? 'default' },
    });
  }

  if (bodies.length === 0) return { ok: true };

  const sideEffects: SideEffectIntent[] = [collectionInvalidateResolverIntent(collectionUid, ctx.hlc)];
  const batch = mintBatch(ctx, bodies);
  return applyPayload({ batch, sideEffects });
}

export type { MutationEnvelope };

// `resolveMirror` is exposed for renderer surfaces that need to
// guarantee the mirror is mounted before reads (e.g. the bootstrap
// path in workspace-switch flows).
export { resolveMirror };
