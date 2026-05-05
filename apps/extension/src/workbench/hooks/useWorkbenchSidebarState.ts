/**
 * useWorkbenchSidebarState — host hook lifting Sidebar.tsx's expanded
 * state into the per-tab snapshot's workspace slice.
 *
 * v3 (design § 2.2 / § 2.1.1 follow-up): sidebar expansions live on
 * `WorkbenchWorkspaceData.sidebarExpansions`. Same plumbing pattern as
 * `useEditorGroups` — initial state seeded from the resolved snapshot,
 * mutations route through `perTab.onPersist` so sessionStorage stays
 * authoritative and the (debounced) chrome.storage publish carries the
 * change to new tabs.
 *
 * The component receives setters in `Dispatch<SetStateAction<…>>` form
 * to match the v2 useState shape it lifted — no call-site rewrites.
 */

import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { EditingScopeViewStateApi } from '@/shared/editing-scope-view-state';
import { FACTORY_SIDEBAR_EXPANSIONS, type WorkbenchViewState, type WorkbenchWorkspaceData } from './useToolLayout';

export interface UseWorkbenchSidebarStateApi {
  expandedKeys: Set<string>;
  setExpandedKeys: Dispatch<SetStateAction<Set<string>>>;
  sectionsExpanded: Record<string, boolean>;
  setSectionsExpanded: Dispatch<SetStateAction<Record<string, boolean>>>;
}

function readSliceData(perTab: EditingScopeViewStateApi<WorkbenchViewState>): WorkbenchWorkspaceData['sidebarExpansions'] {
  return perTab.initial.workspace?.data.sidebarExpansions ?? FACTORY_SIDEBAR_EXPANSIONS;
}

export function useWorkbenchSidebarState(
  perTab: EditingScopeViewStateApi<WorkbenchViewState>,
): UseWorkbenchSidebarStateApi {
  const seed = readSliceData(perTab);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set(seed.expandedKeys));
  const [sectionsExpanded, setSectionsExpanded] = useState<Record<string, boolean>>(() => ({
    ...seed.sectionsExpanded,
  }));

  const onPersist = perTab.onPersist;
  // First effect run loads from the resolved snapshot — skip the
  // persist write-back so we don't echo the same state through
  // chrome.storage on mount (matches useEditorGroups' first-render
  // skip pattern).
  const skipNextPersistRef = useRef<boolean>(true);

  // ── Resync on workspace switch ──────────────────────────────────
  // The slice owner (`useWorkbenchWorkspaceSlice`) stamps the new
  // slice; we observe `workspaceId` and reset local state from the
  // slice's new `sidebarExpansions`. No independent subscription to
  // `workspaceChanged` keeps the slice's `workspaceId` invariant
  // honest (BC-V21-4) — the slice owner is the only writer.
  const sliceWorkspaceId = perTab.initial.workspace?.workspaceId ?? null;
  const sliceSidebar = perTab.initial.workspace?.data.sidebarExpansions;
  const lastSeenWorkspaceIdRef = useRef<string | null>(sliceWorkspaceId);
  useEffect(() => {
    if (lastSeenWorkspaceIdRef.current === sliceWorkspaceId) return;
    lastSeenWorkspaceIdRef.current = sliceWorkspaceId;
    const next = sliceSidebar ?? readSliceData(perTab);
    skipNextPersistRef.current = true;
    setExpandedKeys(new Set(next.expandedKeys));
    setSectionsExpanded({ ...next.sectionsExpanded });
  }, [sliceWorkspaceId, sliceSidebar, perTab]);

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    onPersist((prev) => {
      const slice = prev.workspace;
      if (!slice) return prev;
      const nextSidebar: WorkbenchWorkspaceData['sidebarExpansions'] = {
        sectionsExpanded,
        expandedKeys: Array.from(expandedKeys),
      };
      return {
        ...prev,
        workspace: {
          ...slice,
          data: { ...slice.data, sidebarExpansions: nextSidebar },
        },
      };
    });
  }, [expandedKeys, sectionsExpanded, onPersist]);

  return { expandedKeys, setExpandedKeys, sectionsExpanded, setSectionsExpanded };
}
