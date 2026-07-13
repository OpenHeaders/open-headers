/**
 * useInspectorEditorGroups — authoritative state for the panel's split
 * editor. Same architectural pattern as the workspace's useEditorGroups
 * but simplified: no session persistence, no dirty/save tracking, no
 * settings dependency.
 */

import type { EditingScopeViewStateApi } from '@openheaders/ui/shared/editing-scope-view-state';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  activateTabInLeaf,
  type EditorLeaf,
  type EditorNode,
  findLeaf,
  findLeafContainingTab,
  findOppositeLeaf,
  findParentSplit,
  firstLeaf,
  flipParentSplit,
  insertTabIntoLeaf,
  makeLeaf,
  moveTabBetweenLeaves,
  removeAllFromLeaf,
  removeTabFromLeaf,
  reorderTabInLeaf,
  splitLeafWithTab,
  allTabs as treeAllTabs,
  unsplitAll as treeUnsplitAll,
  unsplitLeaf,
  updateTabInLeaf,
} from './editor-groups';
import { type ClosedTab, type InspectorTab, type InspectorTabPatch, tabIsDirty } from './inspector-tab';
import type { PanelViewState, PersistedInspectorTabSession } from './use-panel-tool-layout';

const SESSION_DEBOUNCE_MS = 500;

const MAX_RECENTLY_CLOSED = 20;
const ROOT_LEAF_ID = 'leaf-root';

interface EditorGroupsState {
  root: EditorNode;
  focusedLeafId: string;
  nextId: number;
}

function initialState(): EditorGroupsState {
  return {
    root: makeLeaf(ROOT_LEAF_ID),
    focusedLeafId: ROOT_LEAF_ID,
    nextId: 1,
  };
}

function stateFromTabSession(session: PersistedInspectorTabSession): EditorGroupsState {
  if (session.tabs.length === 0) return initialState();
  const rootLeaf = makeLeaf(ROOT_LEAF_ID);
  const filled = session.tabs.reduce<EditorNode>((acc, tab) => insertTabIntoLeaf(acc, ROOT_LEAF_ID, tab), rootLeaf);
  const activeId =
    session.activeTabId && session.tabs.some((t) => t.id === session.activeTabId)
      ? session.activeTabId
      : (session.tabs[0]?.id ?? null);
  const root = activeId ? activateTabInLeaf(filled, ROOT_LEAF_ID, activeId) : filled;
  return { root, focusedLeafId: ROOT_LEAF_ID, nextId: 1 };
}

function locateTab(root: EditorNode, tabId: string): EditorLeaf | null {
  return findLeafContainingTab(root, tabId);
}

function maybeCollapseEmpty(root: EditorNode, leafId: string): { root: EditorNode; focusLeafId: string } {
  const leaf = findLeaf(root, leafId);
  if (!leaf || leaf.tabs.length > 0) return { root, focusLeafId: leafId };
  const parent = findParentSplit(root, leafId);
  if (!parent) return { root, focusLeafId: leafId };
  const opposite = findOppositeLeaf(root, leafId);
  const survivingId = opposite?.id ?? leafId;
  const next = unsplitLeaf(root, leafId);
  return { root: next, focusLeafId: survivingId };
}

export interface UseInspectorEditorGroupsApi {
  root: EditorNode;
  focusedLeafId: string;
  focusedLeaf: EditorLeaf;
  allTabs: InspectorTab[];
  tabs: InspectorTab[];
  activeTabId: string | null;
  recentlyClosed: ClosedTab[];

  findTabLeafId: (tabId: string) => string | null;

  addTab: (tab: InspectorTab) => void;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: InspectorTabPatch) => void;
  reorderTab: (fromId: string, toId: string) => void;
  reopenTab: (closed: ClosedTab) => void;

  focusLeaf: (leafId: string) => void;

  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  closeTabsToLeft: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;

  splitAndMoveRight: (leafId: string, tabId: string) => void;
  splitAndMoveLeft: (leafId: string, tabId: string) => void;
  splitAndMoveDown: (leafId: string, tabId: string) => void;
  splitAndMoveUp: (leafId: string, tabId: string) => void;
  moveToOppositeGroup: (leafId: string, tabId: string) => void;
  changeSplitterOrientation: (leafId: string) => void;
  unsplit: (leafId: string) => void;
  unsplitAll: () => void;

  moveTabToLeaf: (fromLeafId: string, toLeafId: string, tabId: string, insertAt?: number) => void;
  splitLeafWithDrop: (
    targetLeafId: string,
    direction: 'left' | 'right' | 'top' | 'bottom',
    fromLeafId: string,
    tabId: string,
  ) => void;
}

export interface UseInspectorEditorGroupsArgs {
  perTab: EditingScopeViewStateApi<PanelViewState>;
  /**
   * Live DevTools-session token (from the lifecycle `ready` envelope), or
   * `null` until it arrives. Open editor tabs are restored from the persisted
   * snapshot only when its stamped token matches this one — a reopen
   * (new token) starts with an empty editor.
   */
  liveSessionToken: string | null;
}

export function useInspectorEditorGroups({
  perTab,
  liveSessionToken,
}: UseInspectorEditorGroupsArgs): UseInspectorEditorGroupsApi {
  // Start empty: the persisted tabs are restored one-shot, gated on the live
  // session token, once it arrives (see the restore effect below).
  const initialEditorTabsRef = useRef(perTab.initial.editorTabs);
  const [state, setState] = useState<EditorGroupsState>(initialState);
  const [recentlyClosed, setRecentlyClosed] = useState<ClosedTab[]>([]);

  const liveSessionTokenRef = useRef(liveSessionToken);
  liveSessionTokenRef.current = liveSessionToken;

  const onPersist = perTab.onPersist;
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // First effect run reads the resolved snapshot — skip the persist
  // write-back so we don't echo it back to host storage on mount.
  const skipNextPersistRef = useRef<boolean>(true);

  // One-shot token-gated restore: editor tabs survive an in-session reload
  // (same token) but not a DevTools reopen (changed token). Runs once, when
  // the live token first arrives.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || liveSessionToken == null) return;
    restoredRef.current = true;
    const persisted = initialEditorTabsRef.current;
    if (persisted.sessionToken === liveSessionToken && persisted.tabs.length > 0) {
      // Same DevTools session → restore the persisted tabs. Don't echo the
      // resolved snapshot straight back to storage.
      skipNextPersistRef.current = true;
      setState(stateFromTabSession(persisted));
    } else if (persisted.tabs.length > 0) {
      // A different (or absent) token → these tabs belong to a prior DevTools
      // session; drop them so the reopened session starts with an empty editor.
      onPersist((prev) => ({
        ...prev,
        editorTabs: { tabs: [], activeTabId: null, sessionToken: liveSessionToken },
      }));
    }
  }, [liveSessionToken, onPersist]);

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const projection: PersistedInspectorTabSession = {
        // Dirty mirrors an in-memory draft — a reload can't restore the
        // draft, so a persisted dot would lie.
        tabs: treeAllTabs(state.root).map((t) => (tabIsDirty(t) ? { ...t, dirty: false } : t)),
        activeTabId: findLeaf(state.root, state.focusedLeafId)?.activeTabId ?? null,
        sessionToken: liveSessionTokenRef.current ?? undefined,
      };
      onPersist((prev) => ({ ...prev, editorTabs: projection }));
    }, SESSION_DEBOUNCE_MS);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [state, onPersist]);

  const transform = useCallback((fn: (prev: EditorGroupsState) => EditorGroupsState) => {
    setState((prev) => {
      const next = fn(prev);
      if (
        next === prev ||
        (next.root === prev.root && next.focusedLeafId === prev.focusedLeafId && next.nextId === prev.nextId)
      ) {
        return prev;
      }
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

  const allTabsMemo = useMemo(() => treeAllTabs(state.root), [state.root]);

  // ── Lookups ────────────────────────────────────────────────────

  const findTabLeafId = useCallback((tabId: string) => locateTab(state.root, tabId)?.id ?? null, [state.root]);

  // ── Basic tab operations ──────────────────────────────────────

  const addTab = useCallback(
    (tab: InspectorTab) => {
      transform((prev) => {
        const existingLeaf = locateTab(prev.root, tab.id);
        if (existingLeaf) {
          const nextRoot = activateTabInLeaf(prev.root, existingLeaf.id, tab.id);
          return { ...prev, root: nextRoot, focusedLeafId: existingLeaf.id };
        }
        const targetLeafId = prev.focusedLeafId;
        const nextRoot = insertTabIntoLeaf(prev.root, targetLeafId, tab);
        return { ...prev, root: nextRoot, focusedLeafId: targetLeafId };
      });
      setRecentlyClosed((prev) => prev.filter((c) => c.tab.id !== tab.id));
    },
    [transform],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      transform((prev) => {
        const leaf = locateTab(prev.root, tabId);
        if (!leaf) return prev;
        const tab = leaf.tabs.find((t) => t.id === tabId);
        if (!tab) return prev;

        setRecentlyClosed((rc) =>
          [{ tab, closedAt: Date.now() }, ...rc.filter((c) => c.tab.id !== tabId)].slice(0, MAX_RECENTLY_CLOSED),
        );

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
    (tabId: string, updates: InspectorTabPatch) => {
      transform((prev) => {
        const leaf = locateTab(prev.root, tabId);
        if (!leaf) return prev;
        return { ...prev, root: updateTabInLeaf(prev.root, leaf.id, tabId, updates) };
      });
    },
    [transform],
  );

  const reorderTab = useCallback(
    (fromId: string, toId: string) => {
      transform((prev) => {
        const leaf = locateTab(prev.root, fromId);
        if (!leaf) return prev;
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
      const emptied = removeAllFromLeaf(prev.root, leaf.id);
      const folded = maybeCollapseEmpty(emptied, leaf.id);
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
        if (fromLeafId === targetLeafId && source.tabs.length < 2) return prev;

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

  // Identity-stable API object: every callback above is useCallback-stable
  // and the derived values are memoized, so this changes identity only when
  // the editor state actually changes. Consumers hang effects and memos off
  // the whole object (`renderTabBody`, the value-document opener), so a
  // fresh literal per render would cascade — the registration effect keyed
  // on it once looped the whole panel into React #185.
  return useMemo(
    () => ({
      root: state.root,
      focusedLeafId: state.focusedLeafId,
      focusedLeaf,
      allTabs: allTabsMemo,
      tabs: focusedLeaf.tabs,
      activeTabId: focusedLeaf.activeTabId,
      recentlyClosed,
      findTabLeafId,
      addTab,
      closeTab,
      switchTab,
      updateTab,
      reorderTab,
      reopenTab,
      focusLeaf,
      closeOtherTabs,
      closeAllTabs,
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
    }),
    [
      state.root,
      state.focusedLeafId,
      focusedLeaf,
      allTabsMemo,
      recentlyClosed,
      findTabLeafId,
      addTab,
      closeTab,
      switchTab,
      updateTab,
      reorderTab,
      reopenTab,
      focusLeaf,
      closeOtherTabs,
      closeAllTabs,
      closeTabsToLeft,
      closeTabsToRight,
      splitAndMoveRight,
      splitAndMoveLeft,
      splitAndMoveDown,
      splitAndMoveUp,
      moveToOppositeGroup,
      changeSplitterOrientation,
      unsplit,
      unsplitAllAction,
      moveTabToLeaf,
      splitLeafWithDrop,
    ],
  );
}
