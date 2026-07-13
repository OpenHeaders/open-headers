/**
 * useEditorGroups — authoritative state for the split editor. Owns a
 * recursive tree of editor leaves (each with its own tab
 * strip and active selection) plus a single globally-focused leaf id.
 *
 * This hook is API-compatible with the flat-tab call sites in App.tsx —
 * addTab / closeTab / switchTab / updateTab / replaceTab / reorderTab
 * all take a tabId and route the operation to whichever leaf owns it,
 * without forcing every caller to know the tree exists. On top of that
 * it exposes the split/move/unsplit operations surfaced by the editor
 * context menu.
 */

import type { EditingScopeViewStateApi } from '@openheaders/ui/shared/editing-scope-view-state';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  activateTabInLeaf,
  type EditorLeaf,
  findLeaf,
  firstLeaf,
  insertTabIntoLeaf,
  removeTabFromLeaf,
  reorderTabInLeaf,
  replaceTabInLeaf,
  allTabs as treeAllTabs,
  updateTabInLeaf,
} from '../editor-groups';
import type { ClosedTab, WorkbenchTab } from '../types';
import {
  type EditorGroupsState,
  locateTab,
  maybeCollapseEmpty,
  stateFromTabSession,
  type UseEditorGroupsApi,
} from './editor-groups-shared';
import { useEditorBatchClose } from './use-editor-batch-close';
import { useEditorDndActions } from './use-editor-dnd-actions';
import { useEditorGroupsSession } from './use-editor-groups-session';
import { useEditorSplitActions } from './use-editor-split-actions';
import type { WorkbenchViewState } from './useToolLayout';

const MAX_RECENTLY_CLOSED = 20;
const SKIP_RECENTLY_CLOSED: Set<string> = new Set(['create', 'collection-overview', 'folder-overview']);

export type { EditorGroupsState, EditorGroupsTransform, UseEditorGroupsApi } from './editor-groups-shared';

export interface UseEditorGroupsArgs {
  perTab: EditingScopeViewStateApi<WorkbenchViewState>;
}

export function useEditorGroups({ perTab }: UseEditorGroupsArgs): UseEditorGroupsApi {
  // Mount initial state from the resolved per-tab snapshot. The
  // workspace-aware resolver (useToolLayout.ts) has already filled
  // `perTab.initial.workspace` from either: the donor's matching
  // slice, the workspace's tabSession shadow, or factory defaults —
  // so this read is always safe.
  const initialEditorTabsRef = useRef(perTab.initial.workspace?.data.editorTabs ?? { tabs: [], activeTabId: null });
  const [state, setState] = useState<EditorGroupsState>(() => stateFromTabSession(initialEditorTabsRef.current));
  const [recentlyClosed, setRecentlyClosed] = useState<ClosedTab[]>([]);

  const dirtyMap = useRef<Map<string, boolean>>(new Map());
  const saveRefMap = useRef<Map<string, () => void>>(new Map());

  useEditorGroupsSession({ perTab, state, setState, dirtyMap, saveRefMap });

  /** Atomically mutate the tree via a transform, optionally changing focus. */
  const transform = useCallback((fn: (prev: EditorGroupsState) => EditorGroupsState) => {
    setState((prev) => {
      const next = fn(prev);
      // No-op detection. The reducer may either return `prev` directly
      // (explicit bail-out) or return a fresh state wrapper where every
      // field is reference-equal to prev (e.g. `switchTab` on an already-
      // active tab calls `activateTabInLeaf`, which now returns the same
      // root reference via structural sharing, but the reducer still
      // wraps it in `{ ...prev, root: nextRoot, focusedLeafId: leaf.id }`).
      // In either case, skip the setState so consumers don't get a new
      // identity for their memoized views. Same anti-pattern that caused
      // React #185 in `useToolLayout.patch`.
      if (
        next === prev ||
        (next.root === prev.root && next.focusedLeafId === prev.focusedLeafId && next.nextId === prev.nextId)
      ) {
        return prev;
      }
      // Guarantee focused leaf always exists in the new tree.
      if (!findLeaf(next.root, next.focusedLeafId)) {
        const fallback = firstLeaf(next.root);
        return { ...next, focusedLeafId: fallback.id };
      }
      return next;
    });
  }, []);

  // ── Derived ────────────────────────────────────────────────────

  const focusedLeaf = useMemo<EditorLeaf>(() => {
    return findLeaf(state.root, state.focusedLeafId) ?? firstLeaf(state.root);
  }, [state.root, state.focusedLeafId]);

  const allTabs = useMemo(() => treeAllTabs(state.root), [state.root]);

  // ── Lookups ────────────────────────────────────────────────────

  const findTabLeafId = useCallback((tabId: string) => locateTab(state.root, tabId)?.id ?? null, [state.root]);

  // ── Basic tab operations ──────────────────────────────────────

  const addTab = useCallback(
    (tab: WorkbenchTab) => {
      transform((prev) => {
        // Already open somewhere? Focus that leaf and activate the tab.
        const existingLeaf = locateTab(prev.root, tab.id);
        if (existingLeaf) {
          const nextRoot = activateTabInLeaf(prev.root, existingLeaf.id, tab.id);
          return { ...prev, root: nextRoot, focusedLeafId: existingLeaf.id };
        }
        // Otherwise insert into the currently focused leaf.
        const targetLeafId = prev.focusedLeafId;
        const nextRoot = insertTabIntoLeaf(prev.root, targetLeafId, tab);
        return { ...prev, root: nextRoot, focusedLeafId: targetLeafId };
      });
      // Reopening from recently-closed should remove from that list.
      setRecentlyClosed((prev) => prev.filter((c) => c.tab.id !== tab.id));
    },
    [transform],
  );

  const closeTab = useCallback(
    (tabId: string, force = false) => {
      transform((prev) => {
        const leaf = locateTab(prev.root, tabId);
        if (!leaf) return prev;
        const tab = leaf.tabs.find((t) => t.id === tabId);
        if (!tab) return prev;

        // Skip dirty close unless forced — lifecycle layer handles confirmation.
        if (!force && (tab.dirty || tab.mode === 'request-create')) return prev;

        if (!SKIP_RECENTLY_CLOSED.has(tab.mode)) {
          setRecentlyClosed((rc) =>
            [{ tab, closedAt: Date.now() }, ...rc.filter((c) => c.tab.id !== tabId)].slice(0, MAX_RECENTLY_CLOSED),
          );
        }

        dirtyMap.current.delete(tabId);
        saveRefMap.current.delete(tabId);

        const afterRemove = removeTabFromLeaf(prev.root, leaf.id, tabId);
        const folded = maybeCollapseEmpty(afterRemove, leaf.id);
        const nextFocus = prev.focusedLeafId === leaf.id ? folded.focusLeafId : prev.focusedLeafId;
        return { ...prev, root: folded.root, focusedLeafId: nextFocus };
      });
    },
    [transform],
  );

  const switchTab = useCallback(
    (tabId: string) => {
      transform((prev) => {
        const leaf = locateTab(prev.root, tabId);
        if (!leaf) return prev;
        const nextRoot = activateTabInLeaf(prev.root, leaf.id, tabId);
        return { ...prev, root: nextRoot, focusedLeafId: leaf.id };
      });
    },
    [transform],
  );

  const updateTab = useCallback(
    (tabId: string, updates: Partial<WorkbenchTab>) => {
      transform((prev) => {
        const leaf = locateTab(prev.root, tabId);
        if (!leaf) return prev;
        return { ...prev, root: updateTabInLeaf(prev.root, leaf.id, tabId, updates) };
      });
    },
    [transform],
  );

  const replaceTab = useCallback(
    (oldId: string, newTab: WorkbenchTab) => {
      dirtyMap.current.delete(oldId);
      saveRefMap.current.delete(oldId);
      transform((prev) => {
        const leaf = locateTab(prev.root, oldId);
        if (!leaf) return prev;
        return {
          ...prev,
          root: replaceTabInLeaf(prev.root, leaf.id, oldId, newTab),
          focusedLeafId: leaf.id,
        };
      });
    },
    [transform],
  );

  const reorderTab = useCallback(
    (fromId: string, toId: string) => {
      transform((prev) => {
        const leaf = locateTab(prev.root, fromId);
        if (!leaf) return prev;
        // Only allow intra-leaf reorder via this entry point.
        if (!leaf.tabs.some((t) => t.id === toId)) return prev;
        return { ...prev, root: reorderTabInLeaf(prev.root, leaf.id, fromId, toId) };
      });
    },
    [transform],
  );

  const reopenTab = useCallback(
    (closed: ClosedTab) => {
      addTab(closed.tab);
    },
    [addTab],
  );

  // ── Focus ──────────────────────────────────────────────────────

  const focusLeaf = useCallback(
    (leafId: string) => {
      transform((prev) => {
        if (prev.focusedLeafId === leafId) return prev;
        if (!findLeaf(prev.root, leafId)) return prev;
        return { ...prev, focusedLeafId: leafId };
      });
    },
    [transform],
  );

  const batchCloseActions = useEditorBatchClose({ transform, dirtyMap, saveRefMap });

  const splitActions = useEditorSplitActions({ transform });

  const dndActions = useEditorDndActions({ transform });

  // Identity-stable API object: the callbacks are useCallback-stable, the
  // derived values memoized, and the action bundles memoized in their own
  // hooks, so this changes identity only when editor state actually
  // changes. Consumers key memos and effects on the whole object; a fresh
  // literal per render cascades — the panel twin of this hook looped the
  // whole devpanel into React #185 exactly that way.
  return useMemo(
    () => ({
      root: state.root,
      focusedLeafId: state.focusedLeafId,
      focusedLeaf,
      allTabs,
      tabs: focusedLeaf.tabs,
      activeTabId: focusedLeaf.activeTabId,
      recentlyClosed,
      dirtyMap,
      saveRefMap,
      findTabLeafId,
      addTab,
      closeTab,
      switchTab,
      updateTab,
      replaceTab,
      reorderTab,
      reopenTab,
      focusLeaf,
      ...batchCloseActions,
      ...splitActions,
      ...dndActions,
    }),
    [
      state.root,
      state.focusedLeafId,
      focusedLeaf,
      allTabs,
      recentlyClosed,
      findTabLeafId,
      addTab,
      closeTab,
      switchTab,
      updateTab,
      replaceTab,
      reorderTab,
      reopenTab,
      focusLeaf,
      batchCloseActions,
      splitActions,
      dndActions,
    ],
  );
}

// Re-export pure helpers for callers that only need read access.
export { allLeaves } from '../editor-groups';
