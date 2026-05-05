/**
 * useWorkbenchWorkspaceSlice — single owner of the per-tab snapshot's
 * `workspace` slice identity (design § 2.2 + post-v3 architectural
 * consolidation).
 *
 * The slice's `workspaceId` field IS the source of truth for "which
 * workspace is this tab bound to" (BC-V21-4). Two events can change it:
 *
 *   1. **Cross-workspace inheritance** (new tab opens in workspace A
 *      but donor was workspace B). Handled at mount time by the
 *      resolver in `useToolLayout` — runs `fallThrough(activeId)` and
 *      replaces the slice. This hook does NOT touch that path.
 *
 *   2. **In-tab workspace switch** (user changes the active workspace
 *      while this tab is open). Handled here: a single subscription
 *      to `workspaceChanged` reads the new workspace's tabSession
 *      shadow, builds a fresh `WorkbenchWorkspaceData`, and emits the
 *      new slice in one atomic `perTab.onPersist` call.
 *
 * Sub-consumers of slice fields (`useEditorGroups`,
 * `useWorkbenchSidebarState`) re-derive their local state by watching
 * `perTab.initial.workspace?.workspaceId` as a useEffect dep — they do
 * NOT subscribe to `workspaceChanged` independently. That keeps the
 * write path single-owner and eliminates the racing-onPersist class
 * the prior duplication was open to.
 */

import { subscribe } from '@utils/bridge';
import { useEffect } from 'react';
import type { PerTabStateApi } from '@/shared/per-tab-state';
import { readWorkspaceFallThrough, type WorkbenchViewState } from './useToolLayout';

export function useWorkbenchWorkspaceSlice(perTab: PerTabStateApi<WorkbenchViewState>): void {
  const onPersist = perTab.onPersist;
  useEffect(() => {
    const unsub = subscribe('workspaceChanged', (payload) => {
      const nextId = payload.activeWorkspaceId;
      void readWorkspaceFallThrough(nextId).then((data) => {
        onPersist((prev) => {
          // No-op when the slice is already on this workspace — the
          // resolver may have just rebuilt it (cross-workspace
          // inheritance path) or another listener may have stamped it
          // first; either way we don't need to write.
          if (prev.workspace?.workspaceId === nextId) return prev;
          return { ...prev, workspace: { workspaceId: nextId, data } };
        });
      });
    });
    return unsub;
  }, [onPersist]);
}
