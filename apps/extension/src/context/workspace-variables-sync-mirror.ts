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
  options: CreateWorkspaceVariablesSyncMirrorOptions = {},
): WorkspaceVariablesSyncMirror {
  const core = createSingletonEntityMirror<WorkspaceVariablesMirrorEntry>(
    {
      loggerTag: 'WorkspaceVariablesSyncMirror',
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
        const resp = await call('oh.sync.snapshotWorkspaceVariables');
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

// ── Module-level singleton ───────────────────────────────────────────

let active: WorkspaceVariablesSyncMirror | null = null;

export function getActiveWorkspaceVariablesSyncMirror(): WorkspaceVariablesSyncMirror {
  if (!active) active = createWorkspaceVariablesSyncMirror();
  return active;
}

export function disposeActiveWorkspaceVariablesSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
