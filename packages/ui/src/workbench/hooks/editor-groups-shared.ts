/**
 * Shared contract for the editor-groups hook family — the tree-state
 * model, the persisted-session codec, the pure helpers used by more
 * than one action cluster, and the composed API surface
 * `useEditorGroups` returns.
 */

import type { PersistedTabSession } from '@openheaders/core/storage';
import {
  activateTabInLeaf,
  type EditorLeaf,
  type EditorNode,
  findLeaf,
  findLeafContainingTab,
  findOppositeLeaf,
  findParentSplit,
  insertTabIntoLeaf,
  makeLeaf,
  type TabLike,
  unsplitLeaf,
} from '../editor-groups';
import type { ClosedTab, WorkbenchTab } from '../types';

const ROOT_LEAF_ID = 'leaf-root';

export interface EditorGroupsState {
  root: EditorNode;
  focusedLeafId: string;
  nextId: number;
}

export function stateFromTabSession(session: PersistedTabSession<WorkbenchTab>): EditorGroupsState {
  const clean = session.tabs.map((t) => ({ ...t, dirty: false }));
  const rootLeaf = makeLeaf(ROOT_LEAF_ID);
  const filled = clean.reduce<EditorNode>((acc, tab) => insertTabIntoLeaf(acc, ROOT_LEAF_ID, tab), rootLeaf);
  const activeId =
    session.activeTabId && clean.some((t) => t.id === session.activeTabId)
      ? session.activeTabId
      : (clean[0]?.id ?? null);
  const root = activeId ? activateTabInLeaf(filled, ROOT_LEAF_ID, activeId) : filled;
  return { root, focusedLeafId: ROOT_LEAF_ID, nextId: 1 };
}

export function locateTab(root: EditorNode, tabId: string): EditorLeaf | null {
  return findLeafContainingTab(root, tabId);
}

/**
 * When a leaf is collapsed (all tabs closed) and it has a sibling, fold
 * the split away so we don't leave empty panes in the grid. Returns the
 * new root and the leaf id that should take focus after the fold.
 */
export function maybeCollapseEmpty<T extends TabLike>(
  root: EditorNode<T>,
  leafId: string,
): { root: EditorNode<T>; focusLeafId: string } {
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

/** Atomically mutate the tree via a transform, optionally changing focus — the shared spine every action cluster funnels through. */
export type EditorGroupsTransform = (fn: (prev: EditorGroupsState) => EditorGroupsState) => void;

export interface UseEditorGroupsApi {
  // Tree state
  root: EditorNode;
  focusedLeafId: string;
  focusedLeaf: EditorLeaf;

  // Flat views (derived)
  /** All tabs across every leaf — used for "is this rule already open" lookups. */
  allTabs: WorkbenchTab[];
  /** The focused leaf's tab strip. */
  tabs: WorkbenchTab[];
  /** The focused leaf's active tab id. */
  activeTabId: string | null;

  // Global state
  recentlyClosed: ClosedTab[];
  dirtyMap: React.MutableRefObject<Map<string, boolean>>;
  saveRefMap: React.MutableRefObject<Map<string, () => void>>;

  // Lookups
  findTabLeafId: (tabId: string) => string | null;

  // Basic tab operations — route automatically to the containing leaf.
  addTab: (tab: WorkbenchTab) => void;
  closeTab: (tabId: string, force?: boolean) => void;
  switchTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<WorkbenchTab>) => void;
  replaceTab: (oldId: string, newTab: WorkbenchTab) => void;
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
