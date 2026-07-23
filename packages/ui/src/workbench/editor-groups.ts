/**
 * editor-groups — recursive tree data model for split tab groups.
 * Leaves own a flat list of tabs plus an active
 * selection; internal nodes are splits with an orientation.
 *
 * All functions here are PURE — they take a tree + inputs and return a
 * new tree. The state hook (useEditorGroups) owns the mutable state and
 * runs these transformations through its reducer.
 *
 * The model is generic over the tab item: anything with a stable `id`
 * splits the same way. The editor binds `WorkbenchTab` (the default
 * type argument, so editor call sites read unchanged); the terminal
 * panel binds its own tab refs.
 */

import type { WorkbenchTab } from './types';

/** The only thing the tree needs from a tab — a stable identity. */
export interface TabLike {
  id: string;
}

export type EditorOrientation = 'horizontal' | 'vertical';

export interface EditorLeaf<T extends TabLike = WorkbenchTab> {
  kind: 'leaf';
  /** Stable identifier — survives splits and moves. */
  id: string;
  tabs: T[];
  activeTabId: string | null;
}

export interface EditorSplit<T extends TabLike = WorkbenchTab> {
  kind: 'split';
  id: string;
  /** horizontal = side-by-side (split right); vertical = stacked (split down). */
  orientation: EditorOrientation;
  a: EditorNode<T>;
  b: EditorNode<T>;
}

export type EditorNode<T extends TabLike = WorkbenchTab> = EditorLeaf<T> | EditorSplit<T>;

// ── Leaf factory ─────────────────────────────────────────────────

export function makeLeaf<T extends TabLike = WorkbenchTab>(
  id: string,
  tabs: T[] = [],
  activeTabId: string | null = null,
): EditorLeaf<T> {
  return { kind: 'leaf', id, tabs, activeTabId };
}

// ── Traversal / queries ──────────────────────────────────────────

export function findLeaf<T extends TabLike>(node: EditorNode<T>, leafId: string): EditorLeaf<T> | null {
  if (node.kind === 'leaf') return node.id === leafId ? node : null;
  return findLeaf(node.a, leafId) ?? findLeaf(node.b, leafId);
}

export function findLeafContainingTab<T extends TabLike>(node: EditorNode<T>, tabId: string): EditorLeaf<T> | null {
  if (node.kind === 'leaf') return node.tabs.some((t) => t.id === tabId) ? node : null;
  return findLeafContainingTab(node.a, tabId) ?? findLeafContainingTab(node.b, tabId);
}

export function firstLeaf<T extends TabLike>(node: EditorNode<T>): EditorLeaf<T> {
  return node.kind === 'leaf' ? node : firstLeaf(node.a);
}

export function allLeaves<T extends TabLike>(node: EditorNode<T>): EditorLeaf<T>[] {
  if (node.kind === 'leaf') return [node];
  return [...allLeaves(node.a), ...allLeaves(node.b)];
}

export function allTabs<T extends TabLike>(node: EditorNode<T>): T[] {
  return allLeaves(node).flatMap((l) => l.tabs);
}

/** Walk up from a leaf — returns the chain of splits (closest ancestor first). */
interface ParentLink<T extends TabLike> {
  parent: EditorSplit<T>;
  side: 'a' | 'b';
}

function parentPath<T extends TabLike>(root: EditorNode<T>, targetId: string): ParentLink<T>[] | null {
  if (root.kind === 'leaf') return root.id === targetId ? [] : null;
  if (root.a.kind === 'leaf' && root.a.id === targetId) return [{ parent: root, side: 'a' }];
  if (root.b.kind === 'leaf' && root.b.id === targetId) return [{ parent: root, side: 'b' }];
  const left = parentPath(root.a, targetId);
  if (left) return [...left, { parent: root, side: 'a' }];
  const right = parentPath(root.b, targetId);
  if (right) return [...right, { parent: root, side: 'b' }];
  return null;
}

/** Closest enclosing split for a leaf, or null if it's the root leaf. */
export function findParentSplit<T extends TabLike>(root: EditorNode<T>, leafId: string): EditorSplit<T> | null {
  const path = parentPath(root, leafId);
  if (!path || path.length === 0) return null;
  return path[0].parent;
}

/** Closest enclosing split AND which side the leaf sits on, or null if it's the root leaf. */
export function findParentSplitLink<T extends TabLike>(
  root: EditorNode<T>,
  leafId: string,
): { parent: EditorSplit<T>; side: 'a' | 'b' } | null {
  const path = parentPath(root, leafId);
  if (!path || path.length === 0) return null;
  return path[0];
}

// ── Immutable transforms ─────────────────────────────────────────

/**
 * Replace the first matching leaf in the tree using `transform`. Returns
 * the new root. If the transform returns null, the leaf is unchanged.
 */
function mapLeaf<T extends TabLike>(
  root: EditorNode<T>,
  leafId: string,
  transform: (leaf: EditorLeaf<T>) => EditorNode<T>,
): EditorNode<T> {
  if (root.kind === 'leaf') return root.id === leafId ? transform(root) : root;
  const nextA = mapLeaf(root.a, leafId, transform);
  const nextB = nextA !== root.a ? root.b : mapLeaf(root.b, leafId, transform);
  if (nextA === root.a && nextB === root.b) return root;
  return { ...root, a: nextA, b: nextB };
}

/** Replace an arbitrary node (leaf or split) by id. */
function replaceNode<T extends TabLike>(
  root: EditorNode<T>,
  targetId: string,
  replacement: EditorNode<T>,
): EditorNode<T> {
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
export function insertTabIntoLeaf<T extends TabLike>(
  root: EditorNode<T>,
  leafId: string,
  tab: T,
  insertAt?: number,
): EditorNode<T> {
  return mapLeaf(root, leafId, (leaf) => {
    const filtered = leaf.tabs.filter((t) => t.id !== tab.id);
    const at = insertAt === undefined ? filtered.length : Math.max(0, Math.min(insertAt, filtered.length));
    const nextTabs = [...filtered.slice(0, at), tab, ...filtered.slice(at)];
    return { ...leaf, tabs: nextTabs, activeTabId: tab.id };
  });
}

/** Remove a tab from a leaf. Selects an adjacent tab as active if the
 *  closed one was active; sets active to null if the leaf empties. */
export function removeTabFromLeaf<T extends TabLike>(root: EditorNode<T>, leafId: string, tabId: string): EditorNode<T> {
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
export function updateTabInLeaf<T extends TabLike>(
  root: EditorNode<T>,
  leafId: string,
  tabId: string,
  updates: Partial<T>,
): EditorNode<T> {
  return mapLeaf(root, leafId, (leaf) => {
    const idx = leaf.tabs.findIndex((t) => t.id === tabId);
    if (idx < 0) return leaf;
    const tab = leaf.tabs[idx];
    // Bail out when every field in `updates` already matches the current
    // tab — returning the same `leaf` reference lets `mapLeaf` bubble the
    // no-op all the way up to `root` via its identity-check, which in
    // turn lets `useEditorGroups.transform` detect a no-op and skip
    // setState. Without this check, a harmless sync effect that fires
    // `updateTab(id, { label: current.label })` would still allocate a
    // fresh tree on every tick.
    let hasChange = false;
    for (const key of Object.keys(updates) as Array<keyof T>) {
      if (tab[key] !== updates[key]) {
        hasChange = true;
        break;
      }
    }
    if (!hasChange) return leaf;
    const nextTabs = leaf.tabs.slice();
    nextTabs[idx] = { ...tab, ...updates };
    return { ...leaf, tabs: nextTabs };
  });
}

/** Replace a tab wholesale inside a leaf (used for draft → saved transitions). */
export function replaceTabInLeaf<T extends TabLike>(
  root: EditorNode<T>,
  leafId: string,
  oldTabId: string,
  newTab: T,
): EditorNode<T> {
  return mapLeaf(root, leafId, (leaf) => ({
    ...leaf,
    tabs: leaf.tabs.map((t) => (t.id === oldTabId ? newTab : t)),
    activeTabId: leaf.activeTabId === oldTabId ? newTab.id : leaf.activeTabId,
  }));
}

/** arrayMove-style reorder inside a leaf. */
export function reorderTabInLeaf<T extends TabLike>(
  root: EditorNode<T>,
  leafId: string,
  fromId: string,
  toId: string,
): EditorNode<T> {
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
export function activateTabInLeaf<T extends TabLike>(root: EditorNode<T>, leafId: string, tabId: string): EditorNode<T> {
  return mapLeaf(root, leafId, (leaf) => {
    if (!leaf.tabs.some((t) => t.id === tabId)) return leaf;
    // Already active — return the same leaf reference so the no-op
    // propagates up through `mapLeaf` into `transform`, preventing a
    // setState on idempotent switches (same anti-pattern that bit us
    // in `useToolLayout.patch`).
    if (leaf.activeTabId === tabId) return leaf;
    return { ...leaf, activeTabId: tabId };
  });
}

// ── Split operations ────────────────────────────────────────────

export interface SplitResult<T extends TabLike = WorkbenchTab> {
  root: EditorNode<T>;
  newLeafId: string;
}

/**
 * Split a leaf into two: the original keeps its state MINUS the moved
 * tab; a new leaf holds the moved tab. The new leaf goes on the side
 * dictated by `direction`. The orientation of the wrapping split is
 * derived from direction (left/right → horizontal, top/bottom → vertical).
 */
export function splitLeafWithTab<T extends TabLike>(
  root: EditorNode<T>,
  leafId: string,
  direction: 'left' | 'right' | 'top' | 'bottom',
  tab: T,
  newLeafId: string,
  splitId: string,
): SplitResult<T> {
  const orientation: EditorOrientation = direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical';
  const putOnSecond = direction === 'right' || direction === 'bottom';

  const nextRoot = mapLeaf(root, leafId, (leaf) => {
    const withoutTab: EditorLeaf<T> = {
      ...leaf,
      tabs: leaf.tabs.filter((t) => t.id !== tab.id),
      activeTabId:
        leaf.activeTabId === tab.id
          ? (leaf.tabs.filter((t) => t.id !== tab.id).slice(-1)[0]?.id ?? null)
          : leaf.activeTabId,
    };
    const newLeaf: EditorLeaf<T> = makeLeaf(newLeafId, [tab], tab.id);
    const split: EditorSplit<T> = {
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
export function unsplitLeaf<T extends TabLike>(root: EditorNode<T>, leafId: string): EditorNode<T> {
  const link = parentPath(root, leafId)?.[0];
  if (!link) return root;
  const { parent, side } = link;
  const self = side === 'a' ? (parent.a as EditorLeaf<T>) : (parent.b as EditorLeaf<T>);
  const other = side === 'a' ? parent.b : parent.a;

  const mergedTabs: T[] = [...self.tabs];
  for (const leaf of allLeaves(other)) {
    for (const t of leaf.tabs) {
      if (!mergedTabs.some((x) => x.id === t.id)) mergedTabs.push(t);
    }
  }
  const merged: EditorLeaf<T> = {
    kind: 'leaf',
    id: self.id,
    tabs: mergedTabs,
    activeTabId: self.activeTabId ?? mergedTabs[0]?.id ?? null,
  };
  return replaceNode(root, parent.id, merged);
}

/** Flatten every split in the tree into a single leaf holding every tab. */
export function unsplitAll<T extends TabLike>(root: EditorNode<T>, survivingLeafId?: string): EditorNode<T> {
  const leaves = allLeaves(root);
  const tabs: T[] = [];
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
export function flipParentSplit<T extends TabLike>(root: EditorNode<T>, leafId: string): EditorNode<T> {
  const link = parentPath(root, leafId)?.[0];
  if (!link) return root;
  const { parent } = link;
  const flipped: EditorSplit<T> = {
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
export function findOppositeLeaf<T extends TabLike>(root: EditorNode<T>, leafId: string): EditorLeaf<T> | null {
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
export function moveTabBetweenLeaves<T extends TabLike>(
  root: EditorNode<T>,
  fromLeafId: string,
  toLeafId: string,
  tabId: string,
  insertAt?: number,
): EditorNode<T> {
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

/** Empty a leaf in place (keep the leaf itself). */
export function removeAllFromLeaf<T extends TabLike>(root: EditorNode<T>, leafId: string): EditorNode<T> {
  return (function walk(node: EditorNode<T>): EditorNode<T> {
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
