/**
 * Renderer-side workspace-variables sync mirror.
 *
 * Thin adapter over {@link createSingletonEntityMirror}. Same
 * shape-of-Entry as the env mirror; lives at workspace scope rather
 * than per-environment.
 */

import { WORKSPACE_VARIABLES_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createSingletonEntityMirror,
  type CreateSingletonMirrorOptions,
} from './singleton-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface WorkspaceVariablesMirrorEntry {
  workspaceVariables: V5.WorkspaceVariables;
  /** Live variable uids. Set member identity is `variable.uid`; this
   *  array is the projected names list. */
  varUids: string[];
}

export type WorkspaceVariablesMirrorListener = () => void;

export interface WorkspaceVariablesSyncMirror {
  getMirror(): WorkspaceVariablesMirrorEntry | null;
  liveVarNames(): string[];
  subscribeMirror(listener: WorkspaceVariablesMirrorListener): () => void;
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
        };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotWorkspaceVariables', { workspaceId });
        const first = resp.entries[0];
        return first
          ? { workspaceVariables: first.workspaceVariables, varUids: first.varUids }
          : null;
      },
    },
    options,
  );
  return {
    getMirror: core.get,
    liveVarNames: () => core.get()?.varUids ?? [],
    subscribeMirror: core.subscribe,
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
