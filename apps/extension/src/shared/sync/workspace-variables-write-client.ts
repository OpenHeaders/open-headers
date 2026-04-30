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
 * `applyWorkspaceVariablesReplacement` is the editor convenience:
 * take the editor's pre-image (`oldVars`) + post-image (`newVars`)
 * and fold them into the catalog primitives — diff is `setWorkspaceVar`
 * for adds/changes and `removeWorkspaceVar` for deletions, all bundled
 * under one `batchId` so the oracle's per-batch all-or-nothing kicks in.
 */

import type { V5 } from '@openheaders/core/types';
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
  type VariableType,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
  WORKSPACE_VARIABLES_PATH,
  workspaceVariablesInvalidateResolverIntent,
} from '@openheaders/core/sync';
import {
  createWorkspaceVariablesSyncMirror,
  getActiveWorkspaceVariablesSyncMirror,
  type WorkspaceVariablesSyncMirror,
} from '@/context/workspace-variables-sync-mirror';
import {
  buildRemoveWorkspaceVarBatch,
  buildRenameWorkspaceVarBatch,
  buildSetWorkspaceVarBatch,
  buildSetWorkspaceVarTypeBatch,
} from '@/shared/sync/workspace-variables-mutations';

// Re-exported so tests can construct a mirror without going through the singleton.
export { createWorkspaceVariablesSyncMirror } from '@/context/workspace-variables-sync-mirror';

export type WorkspaceVariablesSimpleResult = SyncSimpleResult;

export interface WorkspaceVariablesWriteOptions extends BaseSyncWriteOptions {
  mirror?: WorkspaceVariablesSyncMirror;
}

export interface ApplyWorkspaceVarSetInput {
  name: string;
  value: string;
  type?: VariableType;
}

export async function applyWorkspaceVarSet(
  input: ApplyWorkspaceVarSetInput,
  opts: WorkspaceVariablesWriteOptions,
): Promise<WorkspaceVariablesSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetWorkspaceVarBatch(input, ctx));
}

export interface ApplyWorkspaceVarRemoveInput {
  name: string;
}

export async function applyWorkspaceVarRemove(
  input: ApplyWorkspaceVarRemoveInput,
  opts: WorkspaceVariablesWriteOptions,
): Promise<WorkspaceVariablesSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRemoveWorkspaceVarBatch(input, ctx));
}

export interface ApplyWorkspaceVarRenameInput {
  oldName: string;
  newName: string;
  value: string;
  type?: VariableType;
}

export async function applyWorkspaceVarRename(
  input: ApplyWorkspaceVarRenameInput,
  opts: WorkspaceVariablesWriteOptions,
): Promise<WorkspaceVariablesSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameWorkspaceVarBatch(input, ctx));
}

export interface ApplyWorkspaceVarSetTypeInput {
  name: string;
  value: string;
  type: VariableType;
}

export async function applyWorkspaceVarSetType(
  input: ApplyWorkspaceVarSetTypeInput,
  opts: WorkspaceVariablesWriteOptions,
): Promise<WorkspaceVariablesSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetWorkspaceVarTypeBatch(input, ctx));
}

/**
 * Editor convenience: persist a complete variables list. The caller
 * passes the editor's pre-image (`oldVars`) so the helper computes the
 * diff. Adds + value/type changes emit `addToSet`; deletions emit
 * `removeFromSet`. Empty diff → empty batch (no broadcast, no
 * recompile).
 */
export async function applyWorkspaceVariablesReplacement(
  newVars: readonly V5.Variable[],
  oldVars: readonly V5.Variable[],
  opts: WorkspaceVariablesWriteOptions,
): Promise<WorkspaceVariablesSimpleResult> {
  const oldByName = new Map<string, V5.Variable>();
  for (const v of oldVars) oldByName.set(v.name, v);
  const newByName = new Map<string, V5.Variable>();
  for (const v of newVars) {
    if (!v.name.trim()) continue;
    newByName.set(v.name, v);
  }

  const ctx = resolveRendererContext(opts).next({ batchId: opts.batchId ?? `workspace-vars-replace` });

  const bodies: MutationBody[] = [];
  for (const [name] of oldByName) {
    if (newByName.has(name)) continue;
    bodies.push({
      kind: 'removeFromSet',
      type: WORKSPACE_VARIABLES_ENTITY_TYPE,
      id: WORKSPACE_VARIABLES_ID,
      path: WORKSPACE_VARIABLES_PATH,
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
      type: WORKSPACE_VARIABLES_ENTITY_TYPE,
      id: WORKSPACE_VARIABLES_ID,
      path: WORKSPACE_VARIABLES_PATH,
      itemId: name,
      item: { name, value: variable.value, type: variable.type ?? 'default' },
    });
  }

  if (bodies.length === 0) return { ok: true };

  const sideEffects: SideEffectIntent[] = [workspaceVariablesInvalidateResolverIntent(ctx.hlc)];
  const batch = mintBatch(ctx, bodies);
  return applySyncPayload({ batch, sideEffects });
}

export type { MutationEnvelope };

// Pull the active singleton mirror in if a caller wants to read live state.
export function activeMirror(): WorkspaceVariablesSyncMirror {
  return getActiveWorkspaceVariablesSyncMirror();
}
