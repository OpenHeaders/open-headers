/**
 * Renderer-side workspace-variables sync mirror (Phase B).
 *
 * Mirrors `env-sync-mirror.ts` for the singleton workspace-variables
 * entity. Subscribes once to the SW's `syncBroadcast` channel and
 * folds every `workspaceVariablesPostState` payload into a single
 * mutable entry. Renderer write helpers read this mirror to build
 * workspace-variables mutation batches synchronously without a SW
 * round-trip per write (§19.4). On construction the mirror fires
 * `oh.sync.snapshotWorkspaceVariables` so it has a starting view
 * before any broadcast arrives. The subscription is registered first
 * so any concurrent broadcast that lands mid-flight wins.
 */

import { WORKSPACE_VARIABLES_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

export interface WorkspaceVariablesMirrorEntry {
  workspaceVariables: V5.WorkspaceVariables;
  /** Live variable names (set member identity = variable name). */
  varNames: string[];
}

export type WorkspaceVariablesMirrorListener = () => void;

export interface WorkspaceVariablesSyncMirror {
  getMirror(): WorkspaceVariablesMirrorEntry | null;
  /** Live variable names, `[]` when uninitialized. */
  liveVarNames(): string[];
  subscribeMirror(listener: WorkspaceVariablesMirrorListener): () => void;
  dispose(): void;
}

export interface CreateWorkspaceVariablesSyncMirrorOptions {
  bootstrap?: boolean;
}

export function createWorkspaceVariablesSyncMirror(
  options: CreateWorkspaceVariablesSyncMirrorOptions = {},
): WorkspaceVariablesSyncMirror {
  const { bootstrap = true } = options;
  let entry: WorkspaceVariablesMirrorEntry | null = null;
  const listeners = new Set<WorkspaceVariablesMirrorListener>();
  let sawBroadcast = false;

  const notify = (): void => {
    for (const l of listeners) {
      try {
        l();
      } catch {
        // Listener errors must not tear down the broadcast pipe.
      }
    }
  };

  const unsubscribe = subscribe('syncBroadcast', (event) => {
    const { envelope, workspaceVariablesPostState } = event;
    if (envelope.body.type !== WORKSPACE_VARIABLES_ENTITY_TYPE) return;
    sawBroadcast = true;

    if (!workspaceVariablesPostState) {
      if (entry !== null) {
        entry = null;
        notify();
      }
      return;
    }

    entry = {
      workspaceVariables: workspaceVariablesPostState.workspaceVariables,
      varNames: workspaceVariablesPostState.varNames,
    };
    notify();
  });

  if (bootstrap) {
    void call('oh.sync.snapshotWorkspaceVariables')
      .then((resp) => {
        if (sawBroadcast) return;
        const first = resp.entries[0];
        if (!first) return;
        entry = {
          workspaceVariables: first.workspaceVariables,
          varNames: first.varNames,
        };
        notify();
      })
      .catch((err: Error) => {
        logger.info('WorkspaceVariablesSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getMirror() {
      return entry;
    },
    liveVarNames() {
      return entry?.varNames ?? [];
    },
    subscribeMirror(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      unsubscribe();
      entry = null;
      listeners.clear();
    },
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
