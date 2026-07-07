/**
 * Renderer-side imperative entry point for workspace-variables writes.
 *
 * Mirrors `env-write-client.ts` / `collection-write-client.ts` for the
 * singleton workspace-variables entity. Each helper builds a
 * `MutationBatch` against the active workspace-vars mirror and fires
 * `oh.sync.apply` directly — no SW round-trip per primitive, no
 * `setWorkspaceVariables` shim. The §19.4 synchronous-render
 * discipline lives in the editor; this module is what the editor
 * reaches for once the user commits.
 *
 * Identity is `variable.uid`. `applyWorkspaceVarSet` upserts the whole
 * record (handles add, edit, rename, type-toggle uniformly);
 * `applyWorkspaceVarRemove` keys by uid;
 * `applyWorkspaceVariablesReplacement` diffs two lists by uid.
 */

import type { Variable } from '@openheaders/core/types';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';
import {
  keyBetween,
  mintBatch,
  type MutationBody,
  type MutationEnvelope,
  seedKey,
  type SideEffectIntent,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
  WORKSPACE_VARIABLES_PATH,
  workspaceVariablesInvalidateResolverIntent,
} from '@openheaders/core/sync';
import {
  createWorkspaceVariablesSyncMirror,
  getWorkspaceVariablesSyncMirrorForWorkspace,
  type WorkspaceVariablesSyncMirror,
} from '../../context/mirrors/workspace-variables-sync-mirror';
import {
  buildRemoveWorkspaceVarBatch,
  buildSetWorkspaceVarBatch,
} from '@openheaders/core/sync-builders/mutations/workspace-variables-mutations';

// Re-exported so tests can construct a mirror without going through the singleton.
export { createWorkspaceVariablesSyncMirror } from '../../context/mirrors/workspace-variables-sync-mirror';
export type { WorkspaceVariablesSyncMirror } from '../../context/mirrors/workspace-variables-sync-mirror';

export type WorkspaceVariablesSimpleResult = SyncSimpleResult;

export interface WorkspaceVariablesWriteOptions extends BaseSyncWriteOptions {
  mirror?: WorkspaceVariablesSyncMirror;
}

export interface ApplyWorkspaceVarSetInput {
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
}

export async function applyWorkspaceVarSet(
  input: ApplyWorkspaceVarSetInput,
  opts: WorkspaceVariablesWriteOptions,
): Promise<WorkspaceVariablesSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetWorkspaceVarBatch(input, ctx));
}

export interface ApplyWorkspaceVarRemoveInput {
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export async function applyWorkspaceVarRemove(
  input: ApplyWorkspaceVarRemoveInput,
  opts: WorkspaceVariablesWriteOptions,
): Promise<WorkspaceVariablesSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRemoveWorkspaceVarBatch(input, ctx));
}

/**
 * Editor convenience: persist a complete variables list, preserving the
 * editor's row ORDER as fractional-index `orderKey`s (§23.5) so the set
 * materializes back in the same order the user sees — not uid-sorted.
 *
 * Identity is `variable.uid`. Adds + content edits + reorders emit
 * `addToSet`; deletions emit `removeFromSet` by uid. Each surviving row's
 * `orderKey` is assigned LSEQ-style: reuse the row's current key while it
 * keeps the running order monotonic, and mint a fresh `keyBetween` only
 * where the order breaks (a moved row) or a row is new. A row unchanged in
 * both content AND position emits nothing — so a plain value edit re-keys
 * nothing and a pure content save no longer trips the order-sensitive
 * dirty check. Empty diff → `{ ok: true }` (no fire). Mirrors
 * `applyEnvVariablesReplacement`.
 */
export async function applyWorkspaceVariablesReplacement(
  newVars: readonly Variable[],
  oldVars: readonly Variable[],
  opts: WorkspaceVariablesWriteOptions,
): Promise<WorkspaceVariablesSimpleResult> {
  const oldByUid = new Map<string, Variable>();
  for (const v of oldVars) oldByUid.set(v.uid, v);
  const survivors = newVars.filter((v) => v.name.trim());
  const newUids = new Set(survivors.map((v) => v.uid));

  // Current persisted order keys (fractional-index order). The write
  // reuses them to keep unmoved rows byte-stable across saves.
  const mirror = resolveMirror(opts, getWorkspaceVariablesSyncMirrorForWorkspace);
  await mirror.hydrated;
  const currentKeys = new Map(mirror.liveVarOrderKeys().map((e) => [e.itemId, e.orderKey] as const));

  // Assign each survivor an orderKey in editor order: reuse the existing
  // key when it stays strictly greater than the previous assignment,
  // otherwise mint a fresh one after `prev` (seed for the first mint).
  const assigned = new Map<string, string>();
  let prevKey: string | null = null;
  for (const v of survivors) {
    const cur = currentKeys.get(v.uid);
    const reuse = cur !== undefined && (prevKey === null || cur > prevKey);
    const key: string = reuse ? cur : prevKey === null ? seedKey() : keyBetween(prevKey, null);
    assigned.set(v.uid, key);
    prevKey = key;
  }

  const ctx = resolveRendererContext(opts).next({ batchId: opts.batchId ?? `workspace-vars-replace` });

  const bodies: MutationBody[] = [];
  for (const [uid] of oldByUid) {
    if (newUids.has(uid)) continue;
    bodies.push({
      kind: 'removeFromSet',
      type: WORKSPACE_VARIABLES_ENTITY_TYPE,
      id: WORKSPACE_VARIABLES_ID,
      path: WORKSPACE_VARIABLES_PATH,
      itemId: uid,
    });
  }
  for (const variable of survivors) {
    const prev = oldByUid.get(variable.uid);
    const key = assigned.get(variable.uid)!;
    const contentSame =
      prev &&
      prev.name === variable.name &&
      prev.value === variable.value &&
      (prev.type ?? 'default') === (variable.type ?? 'default');
    const keySame = currentKeys.get(variable.uid) === key;
    if (contentSame && keySame) continue;
    bodies.push({
      kind: 'addToSet',
      type: WORKSPACE_VARIABLES_ENTITY_TYPE,
      id: WORKSPACE_VARIABLES_ID,
      path: WORKSPACE_VARIABLES_PATH,
      itemId: variable.uid,
      item: variable,
      orderKey: key,
    });
  }

  if (bodies.length === 0) return { ok: true };

  const sideEffects: SideEffectIntent[] = [workspaceVariablesInvalidateResolverIntent(ctx.hlc)];
  const batch = mintBatch(ctx, bodies);
  return applySyncPayload({ batch, sideEffects });
}

export type { MutationEnvelope };

// Pull the active singleton mirror in if a caller wants to read live state.
export function activeMirror(workspaceId: string): WorkspaceVariablesSyncMirror {
  return getWorkspaceVariablesSyncMirrorForWorkspace(workspaceId);
}
