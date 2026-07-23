/**
 * terminal-panes — module-level owner of the terminal panel's split
 * layout. The registry (terminal-instance.ts) owns tab IDENTITIES and
 * their xterm/pty pairs; this store owns WHERE each tab lives: a
 * recursive leaf tree (the editor-groups model bound to bare tab-id
 * refs), a per-leaf active selection, and the focused leaf.
 *
 * Module state (not a hook) for the same reason as the registry: the
 * dock unmounts hidden tool windows, and the split layout must survive
 * a hide/show round-trip. Splits do NOT persist across app restarts —
 * the editor tab session has the same contract (flat restore into a
 * single root leaf).
 *
 * Ownership of activation is split by direction:
 *   - registry → panes: tab ADDED (created/restored) — it lands in the
 *     focused leaf and becomes its active tab; a pure registry-side
 *     activation (tab-search dropdown) focuses the leaf that owns it.
 *   - panes → registry: tab REMOVED — the surviving in-leaf neighbor
 *     (already picked by the tree removal) is pushed back so the
 *     registry's flat-list neighbor choice never yanks focus across
 *     panes; every structural change also pushes the leaf-concatenated
 *     flat order so persisted order matches what the user sees.
 */

import {
  activateTabInLeaf,
  allLeaves,
  allTabs,
  type EditorNode,
  type EditorOrientation,
  findLeaf,
  findLeafContainingTab,
  findOppositeLeaf,
  findParentSplitLink,
  firstLeaf,
  flipParentSplit,
  insertTabIntoLeaf,
  makeLeaf,
  moveTabBetweenLeaves,
  removeTabFromLeaf,
  reorderTabInLeaf,
  splitLeafWithTab,
  unsplitAll as treeUnsplitAll,
  unsplitLeaf,
} from '../../../editor-groups';
import { maybeCollapseEmpty } from '../../../hooks/editor-groups-shared';
import { getWorkbenchTerminalTabs, type WorkbenchTerminalTabs } from './terminal-instance';

/** A leaf item — just the tab's identity; the registry owns the rest. */
export interface TerminalPaneRef {
  id: string;
}

export type TerminalPaneNode = EditorNode<TerminalPaneRef>;
export type TerminalPaneLeafId = string;
export type SplitDirection = 'left' | 'right' | 'top' | 'bottom';

export interface WorkbenchTerminalPanes {
  root(): TerminalPaneNode;
  focusedLeafId(): string;
  focusLeaf(leafId: string): void;
  /** Activate a tab within its leaf AND focus that leaf. */
  activateTab(leafId: string, tabId: string): void;
  /** Same-leaf drag reorder (drop on another tab in the strip). */
  reorderTab(leafId: string, fromId: string, toId: string): void;
  /** Cross-leaf drop onto a tab / strip — insert at `insertAt`. */
  moveTabToLeaf(fromLeafId: string, toLeafId: string, tabId: string, insertAt?: number): void;
  /** Drop on a leaf's edge/center zone — split or center-move. */
  splitLeafWithDrop(targetLeafId: string, direction: SplitDirection, fromLeafId: string, tabId: string): void;
  // Context-menu verbs (editor tab strip parity).
  splitAndMove(leafId: string, tabId: string, direction: SplitDirection): void;
  moveToOppositeGroup(leafId: string, tabId: string): void;
  changeSplitterOrientation(leafId: string): void;
  unsplit(leafId: string): void;
  unsplitAll(): void;
  /** Fires on any layout/focus/activation change. */
  subscribe(listener: () => void): () => void;
}

const ROOT_LEAF_ID = 'leaf-root';

interface PanesState {
  root: TerminalPaneNode;
  focusedLeafId: string;
  nextId: number;
  listeners: Set<() => void>;
  /** Guards the reconcile ↔ push-back echo (registry notify re-enters). */
  reconciling: boolean;
}

let store: PanesState | null = null;

function notify(state: PanesState): void {
  for (const listener of state.listeners) listener();
}

/** Push the leaf-concatenated order into the registry so persisted
 *  restore order matches the visual order. */
function pushOrder(state: PanesState, registry: WorkbenchTerminalTabs): void {
  registry.setOrder(allTabs(state.root).map((ref) => ref.id));
}

function applyTransform(
  state: PanesState,
  registry: WorkbenchTerminalTabs,
  fn: (prev: { root: TerminalPaneNode; focusedLeafId: string; nextId: number }) => {
    root: TerminalPaneNode;
    focusedLeafId: string;
    nextId: number;
  },
): void {
  const prev = { root: state.root, focusedLeafId: state.focusedLeafId, nextId: state.nextId };
  const next = fn(prev);
  if (next.root === prev.root && next.focusedLeafId === prev.focusedLeafId && next.nextId === prev.nextId) return;
  state.root = next.root;
  state.nextId = next.nextId;
  state.focusedLeafId = findLeaf(next.root, next.focusedLeafId) ? next.focusedLeafId : firstLeaf(next.root).id;
  // Focused leaf's active tab is THE active tab — keep the registry
  // (persistence + any flat consumer) on it.
  const focusedActive = findLeaf(state.root, state.focusedLeafId)?.activeTabId ?? null;
  pushOrder(state, registry);
  if (focusedActive !== null && registry.activeId() !== focusedActive) registry.activateTab(focusedActive);
  notify(state);
}

/**
 * Converge the tree on the registry's tab list. Additions land in the
 * focused leaf (activated — creation activates registry-side);
 * removals fold empty leaves away and push the surviving in-leaf
 * neighbor back to the registry; a pure activation change focuses the
 * owning leaf.
 */
function reconcile(state: PanesState, registry: WorkbenchTerminalTabs): void {
  if (state.reconciling) return;
  state.reconciling = true;
  try {
    const infos = registry.list();
    const liveIds = new Set(infos.map((tab) => tab.id));

    let root = state.root;
    let focused = state.focusedLeafId;
    let removedAny = false;

    for (const leaf of allLeaves(root)) {
      for (const ref of leaf.tabs) {
        if (liveIds.has(ref.id)) continue;
        removedAny = true;
        const afterRemove = removeTabFromLeaf(root, leaf.id, ref.id);
        const folded = maybeCollapseEmpty(afterRemove, leaf.id);
        root = folded.root;
        if (focused === leaf.id) focused = folded.focusLeafId;
      }
    }

    const present = new Set(allTabs(root).map((ref) => ref.id));
    let addedAny = false;
    if (!findLeaf(root, focused)) focused = firstLeaf(root).id;
    for (const info of infos) {
      if (present.has(info.id)) continue;
      addedAny = true;
      root = insertTabIntoLeaf(root, focused, { id: info.id });
    }

    const changed = root !== state.root || focused !== state.focusedLeafId;
    state.root = root;
    state.focusedLeafId = focused;

    if (removedAny) {
      // Pane wins on removals: the tree already picked the in-leaf
      // neighbor; overrule the registry's flat-list choice.
      const focusedActive = findLeaf(root, focused)?.activeTabId ?? null;
      if (focusedActive !== null && registry.activeId() !== focusedActive) registry.activateTab(focusedActive);
    } else if (!addedAny) {
      // Pure activation change (e.g. the tab-search dropdown) — follow
      // the registry to whichever leaf owns the tab.
      const activeId = registry.activeId();
      if (activeId !== null) {
        const owner = findLeafContainingTab(root, activeId);
        if (owner && (owner.activeTabId !== activeId || focused !== owner.id)) {
          state.root = activateTabInLeaf(root, owner.id, activeId);
          state.focusedLeafId = owner.id;
          notify(state);
          return;
        }
      }
    }
    if (changed || addedAny) notify(state);
  } finally {
    state.reconciling = false;
  }
}

/**
 * The singleton terminal pane store, created on first call and bound to
 * the terminal tab registry. Null on hosts without the `terminal`
 * capability (mirrors the registry).
 */
export function getWorkbenchTerminalPanes(): WorkbenchTerminalPanes | null {
  const registry = getWorkbenchTerminalTabs();
  if (!registry) return null;
  if (store) return api(store, registry);

  const state: PanesState = {
    root: makeLeaf<TerminalPaneRef>(ROOT_LEAF_ID),
    focusedLeafId: ROOT_LEAF_ID,
    nextId: 1,
    listeners: new Set(),
    reconciling: false,
  };
  store = state;
  registry.onTabsChange(() => reconcile(state, registry));
  reconcile(state, registry);
  return api(state, registry);
}

function api(state: PanesState, registry: WorkbenchTerminalTabs): WorkbenchTerminalPanes {
  const transform = (
    fn: (prev: { root: TerminalPaneNode; focusedLeafId: string; nextId: number }) => {
      root: TerminalPaneNode;
      focusedLeafId: string;
      nextId: number;
    },
  ) => applyTransform(state, registry, fn);

  return {
    root: () => state.root,
    focusedLeafId: () => state.focusedLeafId,
    focusLeaf: (leafId) =>
      transform((prev) => {
        if (prev.focusedLeafId === leafId || !findLeaf(prev.root, leafId)) return prev;
        return { ...prev, focusedLeafId: leafId };
      }),
    activateTab: (leafId, tabId) =>
      transform((prev) => ({
        ...prev,
        root: activateTabInLeaf(prev.root, leafId, tabId),
        focusedLeafId: findLeaf(prev.root, leafId) ? leafId : prev.focusedLeafId,
      })),
    reorderTab: (leafId, fromId, toId) =>
      transform((prev) => ({ ...prev, root: reorderTabInLeaf(prev.root, leafId, fromId, toId) })),
    moveTabToLeaf: (fromLeafId, toLeafId, tabId, insertAt) =>
      transform((prev) => {
        const next = moveTabBetweenLeaves(prev.root, fromLeafId, toLeafId, tabId, insertAt);
        const folded =
          fromLeafId !== toLeafId ? maybeCollapseEmpty(next, fromLeafId) : { root: next, focusLeafId: fromLeafId };
        return { ...prev, root: folded.root, focusedLeafId: toLeafId };
      }),
    splitLeafWithDrop: (targetLeafId, direction, fromLeafId, tabId) =>
      transform((prev) => {
        const source = findLeaf(prev.root, fromLeafId);
        if (!source) return prev;
        const tab = source.tabs.find((t) => t.id === tabId);
        if (!tab) return prev;
        // Refuse to split a leaf into itself when it holds only one tab.
        if (fromLeafId === targetLeafId && source.tabs.length < 2) return prev;

        const afterRemove = removeTabFromLeaf(prev.root, fromLeafId, tabId);
        const target = findLeaf(afterRemove, targetLeafId);
        if (!target) return prev;

        const newLeafId = `leaf-${prev.nextId}`;
        const splitId = `split-${prev.nextId}`;
        const { root } = splitLeafWithTab(afterRemove, targetLeafId, direction, tab, newLeafId, splitId);
        const folded =
          fromLeafId !== targetLeafId ? maybeCollapseEmpty(root, fromLeafId) : { root, focusLeafId: newLeafId };
        return { root: folded.root, focusedLeafId: newLeafId, nextId: prev.nextId + 1 };
      }),
    splitAndMove: (leafId, tabId, direction) =>
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
      }),
    moveToOppositeGroup: (leafId, tabId) =>
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
      }),
    changeSplitterOrientation: (leafId) =>
      transform((prev) => ({ ...prev, root: flipParentSplit(prev.root, leafId) })),
    unsplit: (leafId) =>
      transform((prev) => ({ ...prev, root: unsplitLeaf(prev.root, leafId), focusedLeafId: leafId })),
    unsplitAll: () =>
      transform((prev) => {
        const next = treeUnsplitAll(prev.root, prev.focusedLeafId);
        return { ...prev, root: next, focusedLeafId: firstLeaf(next).id };
      }),
    subscribe: (listener) => {
      state.listeners.add(listener);
      return () => {
        state.listeners.delete(listener);
      };
    },
  };
}

/** Orientation of the split directly above a leaf — context-menu icon
 *  + enablement input (null for the root leaf). */
export function parentOrientationOf(root: TerminalPaneNode, leafId: string): EditorOrientation | null {
  return findParentSplitLink(root, leafId)?.parent.orientation ?? null;
}

/** Direction label for "Move To Opposite Group" — mirrors the editor
 *  strip's arrow computation. Null when the leaf has no sibling. */
export function oppositeDirectionOf(root: TerminalPaneNode, leafId: string): 'left' | 'right' | 'up' | 'down' | null {
  const link = findParentSplitLink(root, leafId);
  if (!link) return null;
  if (link.parent.orientation === 'horizontal') return link.side === 'a' ? 'right' : 'left';
  return link.side === 'a' ? 'down' : 'up';
}
