/**
 * useEditingScopeWorkspaceId — single seam for "which workspace is this workbench
 * tab editing right now?"
 *
 * Workbench tabs are always per-tab: their editing-scope workspace is
 * pinned by the URL hash (`#/ws/<wsId>/...`) and mirrored into the
 * tab's slice. Switching workspace inside a tab rewrites that tab's
 * URL only — other tabs are unaffected unless the user separately
 * promotes the workspace to ACTIVE.
 *
 * The fall-through order is:
 *   1. The tab's slice binding — populated from the URL on cold mount,
 *      updated by in-tab switcher gestures. Only honored when the
 *      bound workspace still exists in the live mirror; otherwise the
 *      pin is dangling (workspace was deleted at runtime while the tab
 *      was open) and we fall through to (2).
 *   2. The runtime-Active workspace — used by tabs that have no slice
 *      binding yet (legacy bookmarks without `/ws/<wsId>/`, or fresh
 *      tabs whose URL parse failed) and by tabs whose pinned workspace
 *      was just deleted (the write client flips global active to a
 *      neighbour in the same batch, so this is always a live id).
 *
 * Popup, side-panel, and devtools-panel surfaces use
 * `useActiveWorkspaceId()` instead — they're system-scoped and always
 * reflect ACTIVE (per design § 5.2 + § 5.4).
 */

import { getActiveExtensionWorkspaceSyncMirror } from '@openheaders/ui/context';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/useActiveWorkspaceId';
import type { EditingScopeViewStateApi } from '@openheaders/ui/shared/editing-scope-view-state';
import { useEffect, useState } from 'react';
import type { WorkbenchViewState } from './useToolLayout';

/**
 * Reactively report whether `id` exists in the workspace mirror. Used
 * by the editing-scope resolver to detect a dangling tab binding when
 * the bound workspace is deleted at runtime.
 */
function useWorkspaceExists(id: string | null): boolean {
  const [exists, setExists] = useState<boolean>(() => {
    if (!id) return false;
    return getActiveExtensionWorkspaceSyncMirror().liveWorkspaces().some((w) => w.id === id);
  });

  useEffect(() => {
    if (!id) {
      setExists(false);
      return;
    }
    const mirror = getActiveExtensionWorkspaceSyncMirror();
    const recompute = (): void => {
      setExists(mirror.liveWorkspaces().some((w) => w.id === id));
    };
    recompute();
    return mirror.subscribeMirror(recompute);
  }, [id]);

  return exists;
}

export function useEditingScopeWorkspaceId(perTab: EditingScopeViewStateApi<WorkbenchViewState>): string | null {
  const globalActive = useActiveWorkspaceId();
  const tabBound = perTab.initial.workspace?.workspaceId ?? null;
  const tabBoundExists = useWorkspaceExists(tabBound);
  if (tabBound && tabBoundExists) return tabBound;
  return globalActive;
}
