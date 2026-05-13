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
  resolveRendererContext,
  type SyncSimpleResult,
} from '@/shared/sync/apply-payload';
import {
  mintBatch,
  type MutationBody,
  type MutationEnvelope,
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
} from '@/context/workspace-variables-sync-mirror';
import {
  buildRemoveWorkspaceVarBatch,
  buildSetWorkspaceVarBatch,
} from '@/shared/sync/workspace-variables-mutations';

// Re-exported so tests can construct a mirror without going through the singleton.
export { createWorkspaceVariablesSyncMirror } from '@/context/workspace-variables-sync-mirror';

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
 * Editor convenience: persist a complete variables list. Identity is
 * `variable.uid`. Adds + edits (rename / value / type) emit `addToSet`
 * against the same uid; deletions emit `removeFromSet` by uid. Empty
 * diff → empty batch.
 */
export async function applyWorkspaceVariablesReplacement(
  newVars: readonly Variable[],
  oldVars: readonly Variable[],
  opts: WorkspaceVariablesWriteOptions,
): Promise<WorkspaceVariablesSimpleResult> {
  const oldByUid = new Map<string, Variable>();
  for (const v of oldVars) oldByUid.set(v.uid, v);
  const newByUid = new Map<string, Variable>();
  for (const v of newVars) {
    if (!v.name.trim()) continue;
    newByUid.set(v.uid, v);
  }

  const ctx = resolveRendererContext(opts).next({ batchId: opts.batchId ?? `workspace-vars-replace` });

  const bodies: MutationBody[] = [];
  for (const [uid] of oldByUid) {
    if (newByUid.has(uid)) continue;
    bodies.push({
      kind: 'removeFromSet',
      type: WORKSPACE_VARIABLES_ENTITY_TYPE,
      id: WORKSPACE_VARIABLES_ID,
      path: WORKSPACE_VARIABLES_PATH,
      itemId: uid,
    });
  }
  for (const [uid, variable] of newByUid) {
    const prev = oldByUid.get(uid);
    if (
      prev &&
      prev.name === variable.name &&
      prev.value === variable.value &&
      (prev.type ?? 'default') === (variable.type ?? 'default')
    ) {
      continue;
    }
    bodies.push({
      kind: 'addToSet',
      type: WORKSPACE_VARIABLES_ENTITY_TYPE,
      id: WORKSPACE_VARIABLES_ID,
      path: WORKSPACE_VARIABLES_PATH,
      itemId: uid,
      item: variable,
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
