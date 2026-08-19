/**
 * Renderer-side workspace-variables sync mirror.
 *
 * Thin adapter over {@link createSingletonEntityMirror}. Same
 * shape-of-Entry as the env mirror; lives at workspace scope rather
 * than per-environment.
 */

import { WORKSPACE_VARIABLES_ENTITY_TYPE, WORKSPACE_VARIABLES_PATH } from '@openheaders/core/sync';
import type { WorkspaceVariables } from '@openheaders/core/types';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';
import { type CreateSingletonMirrorOptions, createSingletonEntityMirror } from './singleton-entity-mirror';
import { callSnapshotRpc } from './snapshot-rpc';

export interface WorkspaceVariablesMirrorEntry {
  workspaceVariables: WorkspaceVariables;
  /** Live variable uids. Set member identity is `variable.uid`; this
   *  array is the projected names list. */
  varUids: string[];
  /** Per-uid order keys at each set path (the vars set, keyed by
   *  `WORKSPACE_VARIABLES_PATH`). Feeds the editor's position-preserving
   *  Save. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type WorkspaceVariablesMirrorListener = () => void;

export interface WorkspaceVariablesSyncMirror {
  getMirror(): WorkspaceVariablesMirrorEntry | null;
  liveVarNames(): string[];
  /** Live `(itemId, orderKey)` pairs for the vars set, in
   *  fractional-index order. `[]` when the singleton is unknown. */
  liveVarOrderKeys(): Array<{ itemId: string; orderKey: string }>;
  subscribeMirror(listener: WorkspaceVariablesMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateWorkspaceVariablesSyncMirrorOptions = CreateSingletonMirrorOptions;

export function createWorkspaceVariablesSyncMirror(
  workspaceId: string,
  options: CreateWorkspaceVariablesSyncMirrorOptions = {},
): WorkspaceVariablesSyncMirror {
  const core = createSingletonEntityMirror<WorkspaceVariablesMirrorEntry>(
    {
      loggerTag: 'WorkspaceVariablesSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, workspaceVariablesPostState } = event;
        if (envelope.body.type !== WORKSPACE_VARIABLES_ENTITY_TYPE) return null;
        if (!workspaceVariablesPostState) return 'tombstone';
        return {
          workspaceVariables: workspaceVariablesPostState.workspaceVariables,
          varUids: workspaceVariablesPostState.varUids,
          setOrderKeys: workspaceVariablesPostState.setOrderKeys,
        };
      },
      fetchSnapshot: async () => {
        const resp = await callSnapshotRpc('oh.sync.snapshotWorkspaceVariables', { workspaceId });
        const first = resp.entries[0];
        return first
          ? {
              workspaceVariables: first.workspaceVariables,
              varUids: first.varUids,
              setOrderKeys: first.setOrderKeys,
            }
          : null;
      },
    },
    options,
  );
  return {
    getMirror: core.get,
    liveVarNames: () => core.get()?.varUids ?? [],
    liveVarOrderKeys: () => core.get()?.setOrderKeys[WORKSPACE_VARIABLES_PATH] ?? [],
    subscribeMirror: core.subscribe,
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────
//
// Symmetric to the SW data plane's `services: Map<workspaceId,
// WorkspaceServiceState>` (commit 1, sub-commit 1a). Each workspace's
// mirror is independent: its bridge subscription filters by
// `event.envelope.workspaceId` at the shared mirror core (M-2), and
// its bootstrap snapshot is fetched scoped to the workspace via
// `oh.sync.snapshotX, { workspaceId }` (M-1). Cross-workspace
// contamination is structurally inexpressible.

const workspaceVariablesSyncMirrorRegistry = createWorkspaceMirrorRegistry<WorkspaceVariablesSyncMirror>(
  (workspaceId) => createWorkspaceVariablesSyncMirror(workspaceId),
);

export function getWorkspaceVariablesSyncMirrorForWorkspace(workspaceId: string): WorkspaceVariablesSyncMirror {
  return workspaceVariablesSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeWorkspaceVariablesSyncMirrorForWorkspace(workspaceId: string): void {
  workspaceVariablesSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllWorkspaceVariablesSyncMirrors(): void {
  workspaceVariablesSyncMirrorRegistry.disposeAll();
}
