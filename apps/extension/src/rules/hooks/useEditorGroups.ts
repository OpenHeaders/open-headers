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

import { subscribe } from '@utils/bridge';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { extensionStorage, OH, wsKeys } from '@/shared/storage';
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
  removeTabFromLeaf,
  reorderTabInLeaf,
  replaceTabInLeaf,
  splitLeafWithTab,
  allTabs as treeAllTabs,
  unsplitAll as treeUnsplitAll,
  unsplitLeaf,
  updateTabInLeaf,
} from '../editor-groups';
import { get as getSetting } from '../settings/store';
import type { ClosedTab, RulesTab } from '../types';

const MAX_RECENTLY_CLOSED = 20;
const SKIP_RECENTLY_CLOSED: Set<string> = new Set(['create', 'collection-overview', 'folder-overview']);
const ROOT_LEAF_ID = 'leaf-root';

// ── Session persistence ─────────────────────────────────────────────
//
// Tab sessions are per-workspace: each workspace remembers its own
// open tabs. Keyed under `oh.ws.<id>.tabSession` via the storage
// registry — switching workspaces swaps the session cleanly. Writes
// are debounced per state change.
//
// The split tree is intentionally NOT persisted — rehydrating a
// multi-leaf layout across viewport sizes is a usability trap. We
// flatten into the root leaf on restore, matching VS Code / JetBrains
// restart behaviour when the previous layout can't be trusted.
const SESSION_DEBOUNCE_MS = 500;

interface PersistedTabSession {
  tabs: RulesTab[];
  activeTabId: string | null;
}

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

function locateTab(root: EditorNode, tabId: string): EditorLeaf | null {
  return findLeafContainingTab(root, tabId);
}

/**
 * When a leaf is collapsed (all tabs closed) and it has a sibling, fold
 * the split away so we don't leave empty panes in the grid. Returns the
 * new root and the leaf id that should take focus after the fold.
 */
function maybeCollapseEmpty(root: EditorNode, leafId: string): { root: EditorNode; focusLeafId: string } {
  const leaf = findLeaf(root, leafId);
  if (!leaf || leaf.tabs.length > 0) return { root, focusLeafId: leafId };
  // Root leaf stays even if empty.
  const parent = findParentSplit(root, leafId);
  if (!parent) return { root, focusLeafId: leafId };

  // Pick the sibling's first leaf as the new focus target.
  const opposite = findOppositeLeaf(root, leafId);
  const survivingId = opposite?.id ?? leafId;
  const next = unsplitLeaf(root, leafId);
  return { root: next, focusLeafId: survivingId };
}

export interface UseEditorGroupsApi {
  // Tree state
  root: EditorNode;
  focusedLeafId: string;
  focusedLeaf: EditorLeaf;

  // Flat views (derived)
  /** All tabs across every leaf — used for "is this rule already open" lookups. */
  allTabs: RulesTab[];
  /** The focused leaf's tab strip. */
  tabs: RulesTab[];
  /** The focused leaf's active tab id. */
  activeTabId: string | null;

  // Global state
  recentlyClosed: ClosedTab[];
  dirtyMap: React.MutableRefObject<Map<string, boolean>>;
  saveRefMap: React.MutableRefObject<Map<string, () => void>>;

  // Lookups
  findTabLeafId: (tabId: string) => string | null;

  // Basic tab operations — route automatically to the containing leaf.
  addTab: (tab: RulesTab) => void;
  closeTab: (tabId: string, force?: boolean) => void;
  switchTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<RulesTab>) => void;
  replaceTab: (oldId: string, newTab: RulesTab) => void;
  reorderTab: (fromId: string, toId: string) => void;
  reopenTab: (closed: ClosedTab) => void;

  // Focus
  focusLeaf: (leafId: string) => void;

  // Batch close helpers — scoped to whichever leaf owns the anchor tab.
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  closeUnmodifiedTabs: () => void;
  closeTabsToLeft: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;

  // Split operations (driven by context menu). "Split and move <dir>" —
  // our tabs are editor instances, not filesystem files, so duplicating
  // the same tab across groups is meaningless. Every split action moves
  // the tab into the freshly-created group rather than cloning it.
  splitAndMoveRight: (leafId: string, tabId: string) => void;
  splitAndMoveLeft: (leafId: string, tabId: string) => void;
  splitAndMoveDown: (leafId: string, tabId: string) => void;
  splitAndMoveUp: (leafId: string, tabId: string) => void;
  moveToOppositeGroup: (leafId: string, tabId: string) => void;
  changeSplitterOrientation: (leafId: string) => void;
  unsplit: (leafId: string) => void;
  unsplitAll: () => void;

  // Cross-leaf DnD primitive
  moveTabToLeaf: (fromLeafId: string, toLeafId: string, tabId: string, insertAt?: number) => void;
  splitLeafWithDrop: (
    targetLeafId: string,
    direction: 'left' | 'right' | 'top' | 'bottom',
    fromLeafId: string,
    tabId: string,
  ) => void;
}

export function useEditorGroups(): UseEditorGroupsApi {
  const [state, setState] = useState<EditorGroupsState>(initialState);
  const [recentlyClosed, setRecentlyClosed] = useState<ClosedTab[]>([]);

  const dirtyMap = useRef<Map<string, boolean>>(new Map());
  const saveRefMap = useRef<Map<string, () => void>>(new Map());
  const sessionRestoredRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeWorkspaceIdRef = useRef<string | null>(null);

  const restoreSession = useCallback((workspaceId: string, allowOverwrite: boolean) => {
    let shouldRestore = false;
    try {
      shouldRestore = getSetting('general.openTo') === 'last' && getSetting('general.restoreTabsOnStartup');
    } catch {
      shouldRestore = false;
    }
    if (!shouldRestore) return;
    void extensionStorage.get(wsKeys(workspaceId).tabSession).then((rawSaved) => {
      const saved = rawSaved as PersistedTabSession | undefined;
      setState((prev) => {
        // Hash-route handler may have opened tabs before the read
        // resolved on first mount — never overwrite live state unless
        // the caller (workspace switch) explicitly allows it.
        if (!allowOverwrite && treeAllTabs(prev.root).length > 0) return prev;
        const clean = (saved?.tabs ?? []).map((t) => ({ ...t, dirty: false }));
        const rootLeaf = makeLeaf(ROOT_LEAF_ID);
        const filled = clean.reduce<EditorNode>((acc, tab) => insertTabIntoLeaf(acc, ROOT_LEAF_ID, tab), rootLeaf);
        const activeId =
          saved?.activeTabId && clean.some((t) => t.id === saved.activeTabId)
            ? saved.activeTabId
            : (clean[0]?.id ?? null);
        const withActive = activeId ? activateTabInLeaf(filled, ROOT_LEAF_ID, activeId) : filled;
        return { ...prev, root: withActive, focusedLeafId: ROOT_LEAF_ID };
      });
    });
  }, []);

  // ── Restore persisted tab session on first mount ────────────────
  //
  // Gated on general.openTo === 'last' AND general.restoreTabsOnStartup.
  // Every other openTo value lands on an empty editor — the caller
  // (App.tsx) is responsible for any "open X by default" behavior.
  //
  // Reads the active workspace id directly from storage (no SW RPC):
  // this effect mounts alongside the shell, and a cold-SW round-trip
  // here would gate session restore behind seconds of latency.
  useEffect(() => {
    if (sessionRestoredRef.current) return;
    sessionRestoredRef.current = true;
    void extensionStorage.get(OH.activeWorkspaceId).then((id) => {
      if (typeof id === 'string' && id.length > 0) {
        activeWorkspaceIdRef.current = id;
        restoreSession(id, false);
      }
    });
  }, [restoreSession]);

  // ── Resync on workspace switch ──────────────────────────────────
  useEffect(() => {
    const unsub = subscribe('workspaceChanged', (payload) => {
      const nextId = payload.activeWorkspaceId;
      if (activeWorkspaceIdRef.current === nextId) return;
      activeWorkspaceIdRef.current = nextId;
      // Cancel any pending persist so we don't write the outgoing
      // workspace's state under the incoming workspace's key.
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      restoreSession(nextId, true);
    });
    return unsub;
  }, [restoreSession]);

  // ── Persist tab session on every state change (debounced) ───────
  useEffect(() => {
    // Skip until the restore pass has run — otherwise the first render
    // would overwrite the persisted session with an empty state.
    if (!sessionRestoredRef.current) return;
    const workspaceId = activeWorkspaceIdRef.current;
    if (!workspaceId) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const snapshot: PersistedTabSession = {
        tabs: treeAllTabs(state.root),
        activeTabId: findLeaf(state.root, state.focusedLeafId)?.activeTabId ?? null,
      };
      void extensionStorage.set(wsKeys(workspaceId).tabSession, snapshot);
    }, SESSION_DEBOUNCE_MS);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [state]);

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
    (tab: RulesTab) => {
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
        if (!force && (tab.dirty || tab.mode === 'create')) return prev;

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
    (tabId: string, updates: Partial<RulesTab>) => {
      transform((prev) => {
        const leaf = locateTab(prev.root, tabId);
        if (!leaf) return prev;
        return { ...prev, root: updateTabInLeaf(prev.root, leaf.id, tabId, updates) };
      });
    },
    [transform],
  );

  const replaceTab = useCallback(
    (oldId: string, newTab: RulesTab) => {
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
      const keep = leaf.tabs.filter((t) => t.dirty || t.mode === 'create');
      for (const t of leaf.tabs) {
        if (!t.dirty && t.mode !== 'create') {
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
