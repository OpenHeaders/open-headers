/**
 * files-view-mode — how a changed-files tree lists its files (the View
 * Mode): as workspace items — what they belong to in the workbench,
 * the panels' sections, collections and entities by name — or as
 * files, by path. ONE choice per workspace for every such tree: the
 * Commit window and its Rollback Changes dialog, the Git window's
 * changes pane, the Push window, a Compare tab, the Paths chip's tree.
 * The shared per-workspace prefs posture.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { createWorkspacePrefsStore } from './workspace-prefs-store';

export type FilesViewMode = 'items' | 'files';

export const DEFAULT_FILES_VIEW_MODE: FilesViewMode = 'items';

const store = createWorkspacePrefsStore<{ mode: FilesViewMode }>({
  storagePrefix: 'oh:gitFilesView',
  defaults: { mode: DEFAULT_FILES_VIEW_MODE },
  parse: (p) => ({ mode: p.mode === 'files' ? 'files' : DEFAULT_FILES_VIEW_MODE }),
});

export function getFilesViewMode(workspaceId: string): FilesViewMode {
  return store.get(workspaceId).mode;
}

export function setFilesViewMode(workspaceId: string, mode: FilesViewMode): void {
  store.patch(workspaceId, { mode });
}

export function useFilesViewMode(workspaceId: string): FilesViewMode {
  const subscribe = useCallback((listener: () => void) => store.subscribe(workspaceId, listener), [workspaceId]);
  return useSyncExternalStore(subscribe, () => store.get(workspaceId).mode);
}
