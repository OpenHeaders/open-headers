/**
 * editor-groups — recursive tree data model for the IDE-style
 * style split editor. Leaves own a flat list of tabs plus an active
 * selection; internal nodes are splits with an orientation.
 *
 * All functions here are PURE — they take a tree + inputs and return a
 * new tree. The state hook (useEditorGroups) owns the mutable state and
 * runs these transformations through its reducer.
 */

import type { RulesTab } from './types';

export type EditorOrientation = 'horizontal' | 'vertical';

export interface EditorLeaf {
  kind: 'leaf';
  /** Stable identifier — survives splits and moves. */
  id: string;
  tabs: RulesTab[];
  activeTabId: string | null;
}

export interface EditorSplit {
  kind: 'split';
  id: string;
  /** horizontal = side-by-side (split right); vertical = stacked (split down). */
  orientation: EditorOrientation;
  a: EditorNode;
  b: EditorNode;
}

export type EditorNode = EditorLeaf | EditorSplit;

// ── Leaf factory ─────────────────────────────────────────────────

export function makeLeaf(id: string, tabs: RulesTab[] = [], activeTabId: string | null = null): EditorLeaf {
  return { kind: 'leaf', id, tabs, activeTabId };
}

// ── Traversal / queries ──────────────────────────────────────────

export function findLeaf(node: EditorNode, leafId: string): EditorLeaf | null {
  if (node.kind === 'leaf') return node.id === leafId ? node : null;
  return findLeaf(node.a, leafId) ?? findLeaf(node.b, leafId);
}

export function findLeafContainingTab(node: EditorNode, tabId: string): EditorLeaf | null {
  if (node.kind === 'leaf') return node.tabs.some((t) => t.id === tabId) ? node : null;
  return findLeafContainingTab(node.a, tabId) ?? findLeafContainingTab(node.b, tabId);
}

export function firstLeaf(node: EditorNode): EditorLeaf {
  return node.kind === 'leaf' ? node : firstLeaf(node.a);
}

export function allLeaves(node: EditorNode): EditorLeaf[] {
  if (node.kind === 'leaf') return [node];
  return [...allLeaves(node.a), ...allLeaves(node.b)];
}

export function allTabs(node: EditorNode): RulesTab[] {
  return allLeaves(node).flatMap((l) => l.tabs);
}

/** Walk up from a leaf — returns the chain of splits (closest ancestor first). */
interface ParentLink {
  parent: EditorSplit;
  side: 'a' | 'b';
}

function parentPath(root: EditorNode, targetId: string, path: ParentLink[] = []): ParentLink[] | null {
  if (root.kind === 'leaf') return root.id === targetId ? path : null;
  if (root.a.kind === 'leaf' && root.a.id === targetId) return [{ parent: root, side: 'a' }, ...path];
  if (root.b.kind === 'leaf' && root.b.id === targetId) return [{ parent: root, side: 'b' }, ...path];
  const left = parentPath(root.a, targetId, path);
  if (left) return [{ parent: root, side: 'a' }, ...left];
  const right = parentPath(root.b, targetId, path);
  if (right) return [{ parent: root, side: 'b' }, ...right];
  return null;
}

/** Closest enclosing split for a leaf, or null if it's the root leaf. */
export function findParentSplit(root: EditorNode, leafId: string): EditorSplit | null {
  const path = parentPath(root, leafId);
  if (!path || path.length === 0) return null;
  return path[0].parent;
}

// ── Immutable transforms ─────────────────────────────────────────

/**
 * Replace the first matching leaf in the tree using `transform`. Returns
 * the new root. If the transform returns null, the leaf is unchanged.
 */
function mapLeaf(root: EditorNode, leafId: string, transform: (leaf: EditorLeaf) => EditorNode): EditorNode {
  if (root.kind === 'leaf') return root.id === leafId ? transform(root) : root;
  const nextA = mapLeaf(root.a, leafId, transform);
  const nextB = nextA !== root.a ? root.b : mapLeaf(root.b, leafId, transform);
  if (nextA === root.a && nextB === root.b) return root;
  return { ...root, a: nextA, b: nextB };
}

/** Replace an arbitrary node (leaf or split) by id. */
function replaceNode(root: EditorNode, targetId: string, replacement: EditorNode): EditorNode {
  if (root.id === targetId) return replacement;
  if (root.kind === 'leaf') return root;
  const nextA = replaceNode(root.a, targetId, replacement);
  const nextB = nextA !== root.a ? root.b : replaceNode(root.b, targetId, replacement);
  if (nextA === root.a && nextB === root.b) return root;
  return { ...root, a: nextA, b: nextB };
}

/**
 * Insert a tab into a leaf at the given position (defaults to end). If
 * the tab already exists in the leaf it's moved to the new position.
 * Always becomes the leaf's active tab.
 */
export function insertTabIntoLeaf(root: EditorNode, leafId: string, tab: RulesTab, insertAt?: number): EditorNode {
  return mapLeaf(root, leafId, (leaf) => {
    const filtered = leaf.tabs.filter((t) => t.id !== tab.id);
    const at = insertAt === undefined ? filtered.length : Math.max(0, Math.min(insertAt, filtered.length));
    const nextTabs = [...filtered.slice(0, at), tab, ...filtered.slice(at)];
    return { ...leaf, tabs: nextTabs, activeTabId: tab.id };
  });
}

/** Remove a tab from a leaf. Selects an adjacent tab as active if the
 *  closed one was active; sets active to null if the leaf empties. */
export function removeTabFromLeaf(root: EditorNode, leafId: string, tabId: string): EditorNode {
  return mapLeaf(root, leafId, (leaf) => {
    const idx = leaf.tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return leaf;
    const nextTabs = [...leaf.tabs.slice(0, idx), ...leaf.tabs.slice(idx + 1)];
    let nextActive = leaf.activeTabId;
    if (leaf.activeTabId === tabId) {
      nextActive = nextTabs.length === 0 ? null : nextTabs[Math.min(idx, nextTabs.length - 1)].id;
    }
    return { ...leaf, tabs: nextTabs, activeTabId: nextActive };
  });
}

/** Update a tab by id inside a leaf (patch merge). */
export function updateTabInLeaf(
  root: EditorNode,
  leafId: string,
  tabId: string,
  updates: Partial<RulesTab>,
): EditorNode {
  return mapLeaf(root, leafId, (leaf) => ({
    ...leaf,
    tabs: leaf.tabs.map((t) => (t.id === tabId ? { ...t, ...updates } : t)),
  }));
}

/** Replace a tab wholesale inside a leaf (used for draft → saved transitions). */
export function replaceTabInLeaf(root: EditorNode, leafId: string, oldTabId: string, newTab: RulesTab): EditorNode {
  return mapLeaf(root, leafId, (leaf) => ({
    ...leaf,
    tabs: leaf.tabs.map((t) => (t.id === oldTabId ? newTab : t)),
    activeTabId: leaf.activeTabId === oldTabId ? newTab.id : leaf.activeTabId,
  }));
}

/** arrayMove-style reorder inside a leaf. */
export function reorderTabInLeaf(root: EditorNode, leafId: string, fromId: string, toId: string): EditorNode {
  return mapLeaf(root, leafId, (leaf) => {
    const fromIdx = leaf.tabs.findIndex((t) => t.id === fromId);
    const toIdx = leaf.tabs.findIndex((t) => t.id === toId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return leaf;
    const next = [...leaf.tabs];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    return { ...leaf, tabs: next };
  });
}

/** Activate a tab in a leaf (no-op if the tab isn't in that leaf). */
export function activateTabInLeaf(root: EditorNode, leafId: string, tabId: string): EditorNode {
  return mapLeaf(root, leafId, (leaf) => {
    if (!leaf.tabs.some((t) => t.id === tabId)) return leaf;
    return { ...leaf, activeTabId: tabId };
  });
}

// ── Split operations ────────────────────────────────────────────

export interface SplitResult {
  root: EditorNode;
  newLeafId: string;
}

/**
 * Split a leaf into two: the original keeps its state MINUS the moved
 * tab; a new leaf holds the moved tab. The new leaf goes on the side
 * dictated by `direction`. The orientation of the wrapping split is
 * derived from direction (left/right → horizontal, top/bottom → vertical).
 */
export function splitLeafWithTab(
  root: EditorNode,
  leafId: string,
  direction: 'left' | 'right' | 'top' | 'bottom',
  tab: RulesTab,
  newLeafId: string,
  splitId: string,
): SplitResult {
  const orientation: EditorOrientation = direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical';
  const putOnSecond = direction === 'right' || direction === 'bottom';

  const nextRoot = mapLeaf(root, leafId, (leaf) => {
    const withoutTab: EditorLeaf = {
      ...leaf,
      tabs: leaf.tabs.filter((t) => t.id !== tab.id),
      activeTabId:
        leaf.activeTabId === tab.id
          ? (leaf.tabs.filter((t) => t.id !== tab.id).slice(-1)[0]?.id ?? null)
          : leaf.activeTabId,
    };
    const newLeaf: EditorLeaf = makeLeaf(newLeafId, [tab], tab.id);
    const split: EditorSplit = {
      kind: 'split',
      id: splitId,
      orientation,
      a: putOnSecond ? withoutTab : newLeaf,
      b: putOnSecond ? newLeaf : withoutTab,
    };
    return split;
  });

  return { root: nextRoot, newLeafId };
}

/**
 * Collapse the parent split of `leafId` — the sibling's tabs are merged
 * into this leaf (appended), and the surviving leaf takes the parent's
 * place in the tree. Returns the surviving leaf id (same as input).
 * No-op if the leaf is the root.
 */
export function unsplitLeaf(root: EditorNode, leafId: string): EditorNode {
  const link = parentPath(root, leafId)?.[0];
  if (!link) return root;
  const { parent, side } = link;
  const self = side === 'a' ? (parent.a as EditorLeaf) : (parent.b as EditorLeaf);
  const other = side === 'a' ? parent.b : parent.a;

  const mergedTabs: RulesTab[] = [...self.tabs];
  for (const leaf of allLeaves(other)) {
    for (const t of leaf.tabs) {
      if (!mergedTabs.some((x) => x.id === t.id)) mergedTabs.push(t);
    }
  }
  const merged: EditorLeaf = {
    kind: 'leaf',
    id: self.id,
    tabs: mergedTabs,
    activeTabId: self.activeTabId ?? mergedTabs[0]?.id ?? null,
  };
  return replaceNode(root, parent.id, merged);
}

/** Flatten every split in the tree into a single leaf holding every tab. */
export function unsplitAll(root: EditorNode, survivingLeafId?: string): EditorNode {
  const leaves = allLeaves(root);
  const tabs: RulesTab[] = [];
  for (const leaf of leaves) {
    for (const t of leaf.tabs) {
      if (!tabs.some((x) => x.id === t.id)) tabs.push(t);
    }
  }
  const keepId = survivingLeafId && leaves.some((l) => l.id === survivingLeafId) ? survivingLeafId : leaves[0].id;
  const keep = leaves.find((l) => l.id === keepId) ?? leaves[0];
  return { kind: 'leaf', id: keepId, tabs, activeTabId: keep.activeTabId ?? tabs[0]?.id ?? null };
}

/** Flip the orientation of the split directly above `leafId`. */
export function flipParentSplit(root: EditorNode, leafId: string): EditorNode {
  const link = parentPath(root, leafId)?.[0];
  if (!link) return root;
  const { parent } = link;
  const flipped: EditorSplit = {
    ...parent,
    orientation: parent.orientation === 'horizontal' ? 'vertical' : 'horizontal',
  };
  return replaceNode(root, parent.id, flipped);
}

/**
 * Find the "opposite" leaf relative to `leafId` — the other side of its
 * immediate parent split. If the sibling is itself a split, descend to
 * its first leaf. Returns null if `leafId` is the root leaf.
 */
export function findOppositeLeaf(root: EditorNode, leafId: string): EditorLeaf | null {
  const link = parentPath(root, leafId)?.[0];
  if (!link) return null;
  const sibling = link.side === 'a' ? link.parent.b : link.parent.a;
  return firstLeaf(sibling);
}

/**
 * Move a tab from one leaf to another. The source leaf loses the tab;
 * the destination leaf gains it at `insertAt` (default: end). The
 * destination leaf becomes the tab's new home and the tab becomes its
 * active selection. If the source leaf empties AND it is not the last
 * leaf in the tree, the caller should follow up with unsplitLeaf.
 */
export function moveTabBetweenLeaves(
  root: EditorNode,
  fromLeafId: string,
  toLeafId: string,
  tabId: string,
  insertAt?: number,
): EditorNode {
  const source = findLeaf(root, fromLeafId);
  if (!source) return root;
  const tab = source.tabs.find((t) => t.id === tabId);
  if (!tab) return root;

  // Same leaf → just reorder.
  if (fromLeafId === toLeafId) {
    if (insertAt === undefined) return root;
    return mapLeaf(root, fromLeafId, (leaf) => {
      const filtered = leaf.tabs.filter((t) => t.id !== tabId);
      const at = Math.max(0, Math.min(insertAt, filtered.length));
      return {
        ...leaf,
        tabs: [...filtered.slice(0, at), tab, ...filtered.slice(at)],
        activeTabId: tabId,
      };
    });
  }

  // Cross-leaf: remove from source first, then insert into destination.
  const afterRemove = removeTabFromLeaf(root, fromLeafId, tabId);
  return insertTabIntoLeaf(afterRemove, toLeafId, tab, insertAt);
}
