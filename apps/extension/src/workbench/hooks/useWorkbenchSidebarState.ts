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
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditingScopeViewStateApi } from '@/shared/editing-scope-view-state';
import type { SidebarView } from '../components/sidebar/types';
import {
  FACTORY_SIDEBAR_EXPANSIONS,
  type SidebarSectionsByView,
  type WorkbenchViewState,
  type WorkbenchWorkspaceData,
} from './useToolLayout';

export interface UseWorkbenchSidebarStateApi {
  expandedKeys: Set<string>;
  setExpandedKeys: Dispatch<SetStateAction<Set<string>>>;
  /** Full per-view section-expansion map. Keyed by SidebarView so
      multiple simultaneously-mounted Sidebar instances each have
      their own slice (no cross-panel collapse leaks). */
  sectionsByView: SidebarSectionsByView;
  /** Read one view's slice. Empty record fall-through if the view
      has never been touched (factory defaults populate every view
      so this is a defensive guard, not the normal path). */
  getSectionsForView: (view: SidebarView) => Record<string, boolean>;
  /** Update one view's slice; preserves all other views' state.
      Accepts the same `SetStateAction` shape Sidebar.tsx already
      uses for its lifted setter. */
  setSectionsForView: (view: SidebarView, updater: SetStateAction<Record<string, boolean>>) => void;
}

function readSliceData(perTab: EditingScopeViewStateApi<WorkbenchViewState>): WorkbenchWorkspaceData['sidebarExpansions'] {
  return perTab.initial.workspace?.data.sidebarExpansions ?? FACTORY_SIDEBAR_EXPANSIONS;
}

function cloneSectionsByView(input: SidebarSectionsByView): SidebarSectionsByView {
  return {
    'http-rules': { ...(input['http-rules'] ?? {}) },
    'api-requests': { ...(input['api-requests'] ?? {}) },
    workflows: { ...(input.workflows ?? {}) },
    variables: { ...(input.variables ?? {}) },
  };
}

export function useWorkbenchSidebarState(
  perTab: EditingScopeViewStateApi<WorkbenchViewState>,
): UseWorkbenchSidebarStateApi {
  const seed = readSliceData(perTab);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set(seed.expandedKeys));
  const [sectionsByView, setSectionsByView] = useState<SidebarSectionsByView>(() => cloneSectionsByView(seed.sectionsExpanded));

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
    setSectionsByView(cloneSectionsByView(next.sectionsExpanded));
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
        sectionsExpanded: sectionsByView,
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
  }, [expandedKeys, sectionsByView, onPersist]);

  const getSectionsForView = useCallback(
    (view: SidebarView): Record<string, boolean> => sectionsByView[view] ?? {},
    [sectionsByView],
  );

  const setSectionsForView = useCallback(
    (view: SidebarView, updater: SetStateAction<Record<string, boolean>>) => {
      setSectionsByView((prev) => {
        const current = prev[view] ?? {};
        const next = typeof updater === 'function' ? updater(current) : updater;
        if (next === current) return prev;
        return { ...prev, [view]: next };
      });
    },
    [],
  );

  return { expandedKeys, setExpandedKeys, sectionsByView, getSectionsForView, setSectionsForView };
}
