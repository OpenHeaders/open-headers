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
  type EditorNode,
  findLeaf,
  findOppositeLeaf,
  firstLeaf,
  flipParentSplit,
  insertTabIntoLeaf,
  moveTabBetweenLeaves,
  removeTabFromLeaf,
  reorderTabInLeaf,
  replaceTabInLeaf,
  splitLeafWithTab,
  allTabs as treeAllTabs,
  unsplitAll as treeUnsplitAll,
  unsplitLeaf,
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
import { useEditorGroupsSession } from './use-editor-groups-session';
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

  // ── Batch close helpers ───────────────────────────────────────

  const closeOtherTabs = useCallback(
    (tabId: string) => {
      transform((prev) => {
        const leaf = locateTab(prev.root, tabId);
        if (!leaf) return prev;
        const keep = leaf.tabs.find((t) => t.id === tabId);
        if (!keep) return prev;
        for (const t of leaf.tabs) {
          if (t.id !== tabId) {
            dirtyMap.current.delete(t.id);
            saveRefMap.current.delete(t.id);
          }
        }
        const cleared = removeAllFromLeaf(prev.root, leaf.id);
        const filled = insertTabIntoLeaf(cleared, leaf.id, keep);
        return { ...prev, root: filled, focusedLeafId: leaf.id };
      });
    },
    [transform],
  );

  const closeAllTabs = useCallback(() => {
    transform((prev) => {
      const leaf = findLeaf(prev.root, prev.focusedLeafId);
      if (!leaf) return prev;
      for (const t of leaf.tabs) {
        dirtyMap.current.delete(t.id);
        saveRefMap.current.delete(t.id);
      }
      const emptied = removeAllFromLeaf(prev.root, leaf.id);
      const folded = maybeCollapseEmpty(emptied, leaf.id);
      return { ...prev, root: folded.root, focusedLeafId: folded.focusLeafId };
    });
  }, [transform]);

  const closeUnmodifiedTabs = useCallback(() => {
    transform((prev) => {
      const leaf = findLeaf(prev.root, prev.focusedLeafId);
      if (!leaf) return prev;
      const keep = leaf.tabs.filter((t) => t.dirty || t.mode === 'request-create');
      for (const t of leaf.tabs) {
        if (!t.dirty && t.mode !== 'request-create') {
          dirtyMap.current.delete(t.id);
          saveRefMap.current.delete(t.id);
        }
      }
      const nextActive =
        leaf.activeTabId && keep.some((t) => t.id === leaf.activeTabId) ? leaf.activeTabId : (keep[0]?.id ?? null);
      const cleared = removeAllFromLeaf(prev.root, leaf.id);
      const filled = keep.reduce<EditorNode>((acc, t) => insertTabIntoLeaf(acc, leaf.id, t), cleared);
      const withActive = nextActive ? activateTabInLeaf(filled, leaf.id, nextActive) : filled;
      const folded = maybeCollapseEmpty(withActive, leaf.id);
      return { ...prev, root: folded.root, focusedLeafId: folded.focusLeafId };
    });
  }, [transform]);

  const closeTabsToLeft = useCallback(
    (tabId: string) => {
      transform((prev) => {
        const leaf = locateTab(prev.root, tabId);
        if (!leaf) return prev;
        const idx = leaf.tabs.findIndex((t) => t.id === tabId);
        if (idx <= 0) return prev;
        const removed = leaf.tabs.slice(0, idx);
        for (const t of removed) {
          dirtyMap.current.delete(t.id);
          saveRefMap.current.delete(t.id);
        }
        const keep = leaf.tabs.slice(idx);
        const cleared = removeAllFromLeaf(prev.root, leaf.id);
        const filled = keep.reduce<EditorNode>((acc, t) => insertTabIntoLeaf(acc, leaf.id, t), cleared);
        const nextActive =
          leaf.activeTabId && keep.some((t) => t.id === leaf.activeTabId) ? leaf.activeTabId : (keep[0]?.id ?? null);
        const withActive = nextActive ? activateTabInLeaf(filled, leaf.id, nextActive) : filled;
        return { ...prev, root: withActive };
      });
    },
    [transform],
  );

  const closeTabsToRight = useCallback(
    (tabId: string) => {
      transform((prev) => {
        const leaf = locateTab(prev.root, tabId);
        if (!leaf) return prev;
        const idx = leaf.tabs.findIndex((t) => t.id === tabId);
        if (idx === -1 || idx === leaf.tabs.length - 1) return prev;
        const removed = leaf.tabs.slice(idx + 1);
        for (const t of removed) {
          dirtyMap.current.delete(t.id);
          saveRefMap.current.delete(t.id);
        }
        const keep = leaf.tabs.slice(0, idx + 1);
        const cleared = removeAllFromLeaf(prev.root, leaf.id);
        const filled = keep.reduce<EditorNode>((acc, t) => insertTabIntoLeaf(acc, leaf.id, t), cleared);
        const nextActive =
          leaf.activeTabId && keep.some((t) => t.id === leaf.activeTabId)
            ? leaf.activeTabId
            : (keep[keep.length - 1]?.id ?? null);
        const withActive = nextActive ? activateTabInLeaf(filled, leaf.id, nextActive) : filled;
        return { ...prev, root: withActive };
      });
    },
    [transform],
  );

  // ── Split operations ──────────────────────────────────────────

  const splitInDirection = useCallback(
    (leafId: string, tabId: string, direction: 'left' | 'right' | 'top' | 'bottom') => {
      transform((prev) => {
        const leaf = findLeaf(prev.root, leafId);
        if (!leaf) return prev;
        const tab = leaf.tabs.find((t) => t.id === tabId);
        if (!tab) return prev;
        // Splitting a single-tab leaf is a no-op (would just move the tab).
        if (leaf.tabs.length < 2) return prev;
        const newLeafId = `leaf-${prev.nextId}`;
        const splitId = `split-${prev.nextId}`;
        const { root, newLeafId: createdId } = splitLeafWithTab(prev.root, leafId, direction, tab, newLeafId, splitId);
        return { root, focusedLeafId: createdId, nextId: prev.nextId + 1 };
      });
    },
    [transform],
  );

  const splitAndMoveRight = useCallback(
    (leafId: string, tabId: string) => splitInDirection(leafId, tabId, 'right'),
    [splitInDirection],
  );
  const splitAndMoveLeft = useCallback(
    (leafId: string, tabId: string) => splitInDirection(leafId, tabId, 'left'),
    [splitInDirection],
  );
  const splitAndMoveDown = useCallback(
    (leafId: string, tabId: string) => splitInDirection(leafId, tabId, 'bottom'),
    [splitInDirection],
  );
  const splitAndMoveUp = useCallback(
    (leafId: string, tabId: string) => splitInDirection(leafId, tabId, 'top'),
    [splitInDirection],
  );

  const moveToOppositeGroup = useCallback(
    (leafId: string, tabId: string) => {
      transform((prev) => {
        const leaf = findLeaf(prev.root, leafId);
        if (!leaf) return prev;
        const opposite = findOppositeLeaf(prev.root, leafId);
        if (opposite) {
          const next = moveTabBetweenLeaves(prev.root, leafId, opposite.id, tabId);
          const folded = maybeCollapseEmpty(next, leafId);
          return { ...prev, root: folded.root, focusedLeafId: opposite.id };
        }
        // No sibling yet → create one via split-right (requires 2+ tabs).
        if (leaf.tabs.length < 2) return prev;
        const tab = leaf.tabs.find((t) => t.id === tabId);
        if (!tab) return prev;
        const newLeafId = `leaf-${prev.nextId}`;
        const splitId = `split-${prev.nextId}`;
        const { root, newLeafId: createdId } = splitLeafWithTab(prev.root, leafId, 'right', tab, newLeafId, splitId);
        return { root, focusedLeafId: createdId, nextId: prev.nextId + 1 };
      });
    },
    [transform],
  );

  const changeSplitterOrientation = useCallback(
    (leafId: string) => {
      transform((prev) => ({ ...prev, root: flipParentSplit(prev.root, leafId) }));
    },
    [transform],
  );

  const unsplit = useCallback(
    (leafId: string) => {
      transform((prev) => {
        const next = unsplitLeaf(prev.root, leafId);
        return { ...prev, root: next, focusedLeafId: leafId };
      });
    },
    [transform],
  );

  const unsplitAllAction = useCallback(() => {
    transform((prev) => {
      const next = treeUnsplitAll(prev.root, prev.focusedLeafId);
      const leaf = firstLeaf(next);
      return { ...prev, root: next, focusedLeafId: leaf.id };
    });
  }, [transform]);

  // ── Cross-leaf DnD ─────────────────────────────────────────────

  const moveTabToLeaf = useCallback(
    (fromLeafId: string, toLeafId: string, tabId: string, insertAt?: number) => {
      transform((prev) => {
        const next = moveTabBetweenLeaves(prev.root, fromLeafId, toLeafId, tabId, insertAt);
        const folded =
          fromLeafId !== toLeafId ? maybeCollapseEmpty(next, fromLeafId) : { root: next, focusLeafId: fromLeafId };
        return { ...prev, root: folded.root, focusedLeafId: toLeafId };
      });
    },
    [transform],
  );

  const splitLeafWithDrop = useCallback(
    (targetLeafId: string, direction: 'left' | 'right' | 'top' | 'bottom', fromLeafId: string, tabId: string) => {
      transform((prev) => {
        const source = findLeaf(prev.root, fromLeafId);
        if (!source) return prev;
        const tab = source.tabs.find((t) => t.id === tabId);
        if (!tab) return prev;
        // Refuse to split a leaf into itself when it holds only one tab.
        if (fromLeafId === targetLeafId && source.tabs.length < 2) return prev;

        // Remove from source first.
        const afterRemove = removeTabFromLeaf(prev.root, fromLeafId, tabId);
        const target = findLeaf(afterRemove, targetLeafId);
        if (!target) return prev;

        const newLeafId = `leaf-${prev.nextId}`;
        const splitId = `split-${prev.nextId}`;
        const { root } = splitLeafWithTab(afterRemove, targetLeafId, direction, tab, newLeafId, splitId);
        const folded =
          fromLeafId !== targetLeafId ? maybeCollapseEmpty(root, fromLeafId) : { root, focusLeafId: newLeafId };
        return {
          ...prev,
          root: folded.root,
          focusedLeafId: newLeafId,
          nextId: prev.nextId + 1,
        };
      });
    },
    [transform],
  );

  return {
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
    closeOtherTabs,
    closeAllTabs,
    closeUnmodifiedTabs,
    closeTabsToLeft,
    closeTabsToRight,
    splitAndMoveRight,
    splitAndMoveLeft,
    splitAndMoveDown,
    splitAndMoveUp,
    moveToOppositeGroup,
    changeSplitterOrientation,
    unsplit,
    unsplitAll: unsplitAllAction,
    moveTabToLeaf,
    splitLeafWithDrop,
  };
}

// ── Helpers ──────────────────────────────────────────────────────

/** Empty a leaf in place (keep the leaf itself). */
function removeAllFromLeaf(root: EditorNode, leafId: string): EditorNode {
  return (function walk(node: EditorNode): EditorNode {
    if (node.kind === 'leaf') {
      if (node.id !== leafId) return node;
      if (node.tabs.length === 0 && node.activeTabId === null) return node;
      return { ...node, tabs: [], activeTabId: null };
    }
    const a = walk(node.a);
    const b = a !== node.a ? node.b : walk(node.b);
    if (a === node.a && b === node.b) return node;
    return { ...node, a, b };
  })(root);
}

// Re-export pure helpers for callers that only need read access.
export { allLeaves } from '../editor-groups';
