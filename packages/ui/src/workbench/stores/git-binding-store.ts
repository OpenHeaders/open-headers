/**
 * git-binding-store — which workspaces have a workspace-tree (git)
 * binding, for the Version Control naming law: the tool window's BASE
 * identity is "Version Control"; it renames to "Git" once the active
 * workspace's directory binding exists (the IDE model — the shell is
 * VCS-neutral, per-VCS content plugs in). Hydrates lazily from
 * `oh.workspaceTree.list` on hosts registering `workspaceGit`, then
 * folds `workspaceTreeGitStatus` frames; hosts without the capability
 * stay empty (teaser tabs read as Version Control).
 */

import { hostBridge } from '@openheaders/core/bridge';
import { hasCapability } from '@openheaders/core/capabilities';
import { useSyncExternalStore } from 'react';

const bound = new Map<string, boolean>();
const listeners = new Set<() => void>();
let hydrateStarted = false;
let frameSubscribed = false;

function notify(): void {
  for (const listener of listeners) listener();
}

function ensureLive(): void {
  if (!hasCapability('workspaceGit')) return;
  if (!frameSubscribed) {
    frameSubscribed = true;
    hostBridge.subscribe('workspaceTreeGitStatus', (payload) => {
      if (bound.get(payload.workspaceId) === payload.status.bound) return;
      bound.set(payload.workspaceId, payload.status.bound);
      notify();
    });
  }
  if (!hydrateStarted) {
    hydrateStarted = true;
    void hostBridge
      .call('oh.workspaceTree.list')
      .then((list) => {
        let changed = false;
        for (const row of list.bindings) {
          if (bound.get(row.workspaceId) !== true) {
            bound.set(row.workspaceId, true);
            changed = true;
          }
        }
        if (changed) notify();
      })
      .catch(() => {
        // Host without the verb table — stays Version Control.
      });
  }
}

/** True when `workspaceId` has a live git binding (false while unknown). */
export function useWorkspaceGitBound(workspaceId: string | null): boolean {
  return useSyncExternalStore(
    (listener) => {
      ensureLive();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => (workspaceId !== null ? (bound.get(workspaceId) ?? false) : false),
  );
}
