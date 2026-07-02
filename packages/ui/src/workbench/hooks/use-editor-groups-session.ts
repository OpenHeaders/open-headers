/**
 * useEditorGroupsSession — session persistence for the split editor.
 * The shell (`useEditorGroups`) seeds its state from the resolved
 * per-tab snapshot; this hook owns the resync-on-workspace-switch and
 * debounced-persist effects plus the refs that guard them.
 */

import { hostStorage, type PersistedTabSession, wsKeys } from '@openheaders/core/storage';
import type { EditingScopeViewStateApi } from '@openheaders/ui/shared/editing-scope-view-state';
import { useEffect, useRef } from 'react';
import { findLeaf, allTabs as treeAllTabs } from '../editor-groups';
import type { WorkbenchTab } from '../types';
import { type EditorGroupsState, stateFromTabSession } from './editor-groups-shared';
import { FACTORY_SIDEBAR_EXPANSIONS, type WorkbenchViewState, type WorkbenchWorkspaceData } from './useToolLayout';

// ── Session persistence ─────────────────────────────────────────────
//
// v2.1: editor-tab session lives in the per-tab snapshot's workspace
// slice (`workspace.data.editorTabs`). The workspace's legacy
// `wsKeys(id).tabSession` key is kept as a SHADOW the per-tab loader
// reads when a new tab opens whose donor was captured in a different
// workspace. The shadow is a fall-through cache, not authoritative
// state — only the snapshot drives the open tab's editor groups.
//
// In-tab workspace switches are handled by `useWorkbenchWorkspaceSlice`
// (the slice owner). When that hook stamps a new `workspace` slice,
// `perTab.initial.workspace?.workspaceId` changes; the effect below
// observes the change and re-derives the editor tree from the new
// slice's `editorTabs`. This hook does NOT subscribe to
// `workspaceChanged` directly — single-owner write path keeps the
// slice's `workspaceId` invariant honest (BC-V21-4).
//
// The split tree itself is intentionally NOT persisted — rehydrating
// a multi-leaf layout across viewport sizes is a usability trap. We
// flatten into the root leaf on restore.
const SESSION_DEBOUNCE_MS = 500;

export interface UseEditorGroupsSessionArgs {
  perTab: EditingScopeViewStateApi<WorkbenchViewState>;
  state: EditorGroupsState;
  setState: React.Dispatch<React.SetStateAction<EditorGroupsState>>;
  dirtyMap: React.MutableRefObject<Map<string, boolean>>;
  saveRefMap: React.MutableRefObject<Map<string, () => void>>;
}

export function useEditorGroupsSession({
  perTab,
  state,
  setState,
  dirtyMap,
  saveRefMap,
}: UseEditorGroupsSessionArgs): void {
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Workspace id stamped on the slice — used at fire time for the
  // shadow-write key. Initialized from the resolved snapshot;
  // `workspaceChanged` events update it before any write fires
  // (BC-V21-6 narrows the race-at-fire-time class).
  const activeWorkspaceIdRef = useRef<string | null>(perTab.initial.workspace?.workspaceId ?? null);
  // First render's effect must NOT persist (would overwrite the
  // resolved slice with the same state we just loaded — wasted write
  // and a debounce-window flicker for the donor record).
  const skipNextPersistRef = useRef<boolean>(true);

  const onPersist = perTab.onPersist;

  // ── Resync on workspace switch ──────────────────────────────────
  // The slice owner (`useWorkbenchWorkspaceSlice`) is the only writer
  // of new `workspace` slices on workspaceChanged events. We observe
  // the slice's `workspaceId` here and re-derive the tree from the
  // new `editorTabs` data — without reading any shadow ourselves and
  // without racing onPersist with the owner.
  const sliceWorkspaceId = perTab.initial.workspace?.workspaceId ?? null;
  const sliceEditorTabs = perTab.initial.workspace?.data.editorTabs;
  useEffect(() => {
    if (activeWorkspaceIdRef.current === sliceWorkspaceId) return;
    activeWorkspaceIdRef.current = sliceWorkspaceId;
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    // Drop transient per-tab editor metadata that's bound to the
    // outgoing workspace — dirtiness tracking and save callbacks
    // reference uids that don't exist in the new workspace.
    dirtyMap.current.clear();
    saveRefMap.current.clear();
    skipNextPersistRef.current = true;
    setState(stateFromTabSession(sliceEditorTabs ?? { tabs: [], activeTabId: null }));
  }, [sliceWorkspaceId, sliceEditorTabs, dirtyMap, saveRefMap, setState]);

  // ── Persist tab session on every state change (debounced) ───────
  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    const workspaceId = activeWorkspaceIdRef.current;
    if (!workspaceId) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const projection: PersistedTabSession<WorkbenchTab> = {
        tabs: treeAllTabs(state.root),
        activeTabId: findLeaf(state.root, state.focusedLeafId)?.activeTabId ?? null,
      };
      onPersist((prev) => {
        if (prev.workspace) {
          return {
            ...prev,
            workspace: {
              ...prev.workspace,
              data: { ...prev.workspace.data, editorTabs: projection },
            },
          };
        }
        const sliceData: WorkbenchWorkspaceData = {
          editorTabs: projection,
          sidebarExpansions: FACTORY_SIDEBAR_EXPANSIONS,
        };
        return { ...prev, workspace: { workspaceId, data: sliceData } };
      });
      // Shadow-write to the workspace's `tabSession` so a future tab
      // opening in this workspace whose donor was captured elsewhere
      // can fall through to this layout (design § 2.2).
      void hostStorage.set(wsKeys(workspaceId).tabSession, projection);
    }, SESSION_DEBOUNCE_MS);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [state, onPersist]);
}
