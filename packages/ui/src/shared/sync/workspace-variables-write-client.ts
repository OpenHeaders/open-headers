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

import {
  type MutationEnvelope,
  mintBatch,
  type SideEffectIntent,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
  WORKSPACE_VARIABLES_PATH,
  workspaceVariablesInvalidateResolverIntent,
} from '@openheaders/core/sync';
import { normalizeVariableRow, synthesizeSetDiff, toLiveSetEntries } from '@openheaders/core/sync-builders';
import {
  buildRemoveWorkspaceVarBatch,
  buildSetWorkspaceVarBatch,
} from '@openheaders/core/sync-builders/mutations/workspace-variables-mutations';
import type { Variable } from '@openheaders/core/types';
import {
  getWorkspaceVariablesSyncMirrorForWorkspace,
  type WorkspaceVariablesSyncMirror,
} from '../../context/mirrors/workspace-variables-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

export type { WorkspaceVariablesSyncMirror } from '../../context/mirrors/workspace-variables-sync-mirror';
// Re-exported so tests can construct a mirror without going through the singleton.
export { createWorkspaceVariablesSyncMirror } from '../../context/mirrors/workspace-variables-sync-mirror';

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
 * Identity is `variable.uid`. The diff is {@link synthesizeSetDiff} —
 * the same LIS-optimal synthesizer the rule / request / template set
 * paths use: `removeFromSet` for deleted uids, `addToSet` (with
 * `orderKey`) for adds + content edits, a minimal set of `moveBefore`
 * envelopes for pure reorders. A row unchanged in both content AND
 * position emits nothing — so a plain value edit re-keys nothing and a
 * pure content save doesn't trip the order-sensitive dirty check.
 * Empty diff → `{ ok: true }` (no fire). Mirrors
 * `applyEnvVariablesReplacement`.
 */
export async function applyWorkspaceVariablesReplacement(
  newVars: readonly Variable[],
  oldVars: readonly Variable[],
  opts: WorkspaceVariablesWriteOptions,
): Promise<WorkspaceVariablesSimpleResult> {
  // Current persisted order keys (fractional-index order). The diff
  // reuses them to keep unmoved rows byte-stable across saves.
  const mirror = resolveMirror(opts, getWorkspaceVariablesSyncMirrorForWorkspace);
  await mirror.hydrated;
  const currentKeys = new Map(mirror.liveVarOrderKeys().map((e) => [e.itemId, e.orderKey] as const));

  // Normalize both sides to the canonical persisted row shape (`type`
  // defaulted, truthy `enabled` stripped) so a conflict-resolution write
  // that set `enabled: true` explicitly can't read as a content edit.
  const bodies = synthesizeSetDiff({
    type: WORKSPACE_VARIABLES_ENTITY_TYPE,
    id: WORKSPACE_VARIABLES_ID,
    path: WORKSPACE_VARIABLES_PATH,
    live: toLiveSetEntries(oldVars.map(normalizeVariableRow), currentKeys),
    newItems: newVars.filter((v) => v.name.trim()).map(normalizeVariableRow),
  });
  if (bodies.length === 0) return { ok: true };

  const ctx = resolveRendererContext(opts).next({ batchId: opts.batchId ?? `workspace-vars-replace` });

  const sideEffects: SideEffectIntent[] = [workspaceVariablesInvalidateResolverIntent(ctx.hlc)];
  const batch = mintBatch(ctx, bodies);
  return applySyncPayload({ batch, sideEffects });
}

export type { MutationEnvelope };

// Pull the active singleton mirror in if a caller wants to read live state.
export function activeMirror(workspaceId: string): WorkspaceVariablesSyncMirror {
  return getWorkspaceVariablesSyncMirrorForWorkspace(workspaceId);
}
