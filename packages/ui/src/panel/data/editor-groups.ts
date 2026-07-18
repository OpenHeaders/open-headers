/**
 * editor-groups — recursive tree data model for the split editor.
 * Leaves own a flat list of tabs plus an active selection; internal
 * nodes are splits with an orientation.
 *
 * All functions are PURE — they take a tree + inputs and return a new
 * tree. Same architectural pattern as the workspace editor-groups.
 */

import {
  cookieTabId,
  domStorageEntryTabId,
  type InspectorTab,
  type InspectorTabPatch,
  ruleEditorTabId,
} from './inspector-tab';

export type EditorOrientation = 'horizontal' | 'vertical';

export interface EditorLeaf {
  kind: 'leaf';
  id: string;
  tabs: InspectorTab[];
  activeTabId: string | null;
}

export interface EditorSplit {
  kind: 'split';
  id: string;
  orientation: EditorOrientation;
  a: EditorNode;
  b: EditorNode;
}

export type EditorNode = EditorLeaf | EditorSplit;

// ── Leaf factory ─────────────────────────────────────────────────

export function makeLeaf(id: string, tabs: InspectorTab[] = [], activeTabId: string | null = null): EditorLeaf {
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

export function allTabs(node: EditorNode): InspectorTab[] {
  return allLeaves(node).flatMap((l) => l.tabs);
}

interface ParentLink {
  parent: EditorSplit;
  side: 'a' | 'b';
}

function parentPath(root: EditorNode, targetId: string): ParentLink[] | null {
  if (root.kind === 'leaf') return root.id === targetId ? [] : null;
  if (root.a.kind === 'leaf' && root.a.id === targetId) return [{ parent: root, side: 'a' }];
  if (root.b.kind === 'leaf' && root.b.id === targetId) return [{ parent: root, side: 'b' }];
  const left = parentPath(root.a, targetId);
  if (left) return [...left, { parent: root, side: 'a' }];
  const right = parentPath(root.b, targetId);
  if (right) return [...right, { parent: root, side: 'b' }];
  return null;
}

export function findParentSplit(root: EditorNode, leafId: string): EditorSplit | null {
  const path = parentPath(root, leafId);
  if (!path || path.length === 0) return null;
  return path[0].parent;
}

export function findParentSplitLink(root: EditorNode, leafId: string): { parent: EditorSplit; side: 'a' | 'b' } | null {
  const path = parentPath(root, leafId);
  if (!path || path.length === 0) return null;
  return path[0];
}

// ── Immutable transforms ─────────────────────────────────────────

function mapLeaf(root: EditorNode, leafId: string, transform: (leaf: EditorLeaf) => EditorNode): EditorNode {
  if (root.kind === 'leaf') return root.id === leafId ? transform(root) : root;
  const nextA = mapLeaf(root.a, leafId, transform);
  const nextB = nextA !== root.a ? root.b : mapLeaf(root.b, leafId, transform);
  if (nextA === root.a && nextB === root.b) return root;
  return { ...root, a: nextA, b: nextB };
}

function replaceNode(root: EditorNode, targetId: string, replacement: EditorNode): EditorNode {
  if (root.id === targetId) return replacement;
  if (root.kind === 'leaf') return root;
  const nextA = replaceNode(root.a, targetId, replacement);
  const nextB = nextA !== root.a ? root.b : replaceNode(root.b, targetId, replacement);
  if (nextA === root.a && nextB === root.b) return root;
  return { ...root, a: nextA, b: nextB };
}

export function insertTabIntoLeaf(root: EditorNode, leafId: string, tab: InspectorTab, insertAt?: number): EditorNode {
  return mapLeaf(root, leafId, (leaf) => {
    const filtered = leaf.tabs.filter((t) => t.id !== tab.id);
    const at = insertAt === undefined ? filtered.length : Math.max(0, Math.min(insertAt, filtered.length));
    const nextTabs = [...filtered.slice(0, at), tab, ...filtered.slice(at)];
    return { ...leaf, tabs: nextTabs, activeTabId: tab.id };
  });
}

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

export function updateTabInLeaf(
  root: EditorNode,
  leafId: string,
  tabId: string,
  updates: InspectorTabPatch,
): EditorNode {
  return mapLeaf(root, leafId, (leaf) => {
    const idx = leaf.tabs.findIndex((t) => t.id === tabId);
    if (idx < 0) return leaf;
    const tab = leaf.tabs[idx];
    // Each patch field applies to matching tab kinds — foreign fields drop.
    let nextTab: InspectorTab;
    if (tab.kind === 'request') {
      if (updates.activeSection === undefined || tab.activeSection === updates.activeSection) return leaf;
      nextTab = { ...tab, activeSection: updates.activeSection };
    } else if (
      tab.kind === 'dom-storage-entry' &&
      updates.entryKey !== undefined &&
      updates.entryKey !== tab.entryKey
    ) {
      // A committed rename moves the tab's identity: the id and label
      // derive from the entry key, so re-opens and the grid's
      // active-row highlight keep matching the renamed entry.
      nextTab = {
        ...tab,
        ...(updates.dirty !== undefined ? { dirty: updates.dirty } : {}),
        entryKey: updates.entryKey,
        label: updates.entryKey,
        id: domStorageEntryTabId(tab.frameId, tab.area, updates.entryKey),
      };
      const renamedTabs = leaf.tabs.slice();
      renamedTabs[idx] = nextTab;
      return {
        ...leaf,
        tabs: renamedTabs,
        activeTabId: leaf.activeTabId === tab.id ? nextTab.id : leaf.activeTabId,
      };
    } else if (tab.kind === 'rule-editor' && updates.ruleUid !== undefined) {
      // Committed rule binding: the first Save minted the rule — re-key
      // a draft tab to the uid and drop the seed payloads (create draft
      // / popover hand-off); the document now reads the live mirror. An
      // edit-mode save re-lands the same id and still sheds its
      // hand-off. A mint always produces a FRESH uid, so the new id can
      // never collide with an open tab.
      const nextId = ruleEditorTabId(updates.ruleUid);
      const shedsPayload = tab.draft !== undefined || tab.handOff !== undefined || tab.draftName !== undefined;
      const dirtyChanges = updates.dirty !== undefined && (tab.dirty ?? false) !== updates.dirty;
      const labelChanges = updates.label !== undefined && updates.label !== tab.label;
      if (nextId === tab.id && !shedsPayload && !dirtyChanges && !labelChanges) return leaf;
      const {
        draft: _draft,
        draftName: _draftName,
        draftConditions: _draftConditions,
        handOff: _handOff,
        ...kept
      } = tab;
      nextTab = {
        ...kept,
        ...(updates.dirty !== undefined ? { dirty: updates.dirty } : {}),
        ...(updates.label !== undefined ? { label: updates.label } : {}),
        ruleUid: updates.ruleUid,
        id: nextId,
      };
      const rekeyedTabs = leaf.tabs.slice();
      rekeyedTabs[idx] = nextTab;
      return {
        ...leaf,
        tabs: rekeyedTabs,
        activeTabId: leaf.activeTabId === tab.id ? nextTab.id : leaf.activeTabId,
      };
    } else if (tab.kind === 'cookie' && updates.cookieKey !== undefined && cookieTabId(updates.cookieKey) !== tab.id) {
      // Same identity-move semantics over the jar key: a committed
      // name / domain / path change re-keys the tab in place.
      nextTab = {
        ...tab,
        ...(updates.dirty !== undefined ? { dirty: updates.dirty } : {}),
        cookieKey: updates.cookieKey,
        label: updates.cookieKey.name,
        id: cookieTabId(updates.cookieKey),
      };
      const renamedTabs = leaf.tabs.slice();
      renamedTabs[idx] = nextTab;
      return {
        ...leaf,
        tabs: renamedTabs,
        activeTabId: leaf.activeTabId === tab.id ? nextTab.id : leaf.activeTabId,
      };
    } else {
      // Cache-entry and value-view documents are read-only — no
      // patchable view state.
      if (tab.kind === 'cache-entry' || tab.kind === 'value-view') return leaf;
      if (updates.dirty === undefined || (tab.dirty ?? false) === updates.dirty) return leaf;
      nextTab = { ...tab, dirty: updates.dirty };
    }
    const nextTabs = leaf.tabs.slice();
    nextTabs[idx] = nextTab;
    return { ...leaf, tabs: nextTabs };
  });
}

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

export function activateTabInLeaf(root: EditorNode, leafId: string, tabId: string): EditorNode {
  return mapLeaf(root, leafId, (leaf) => {
    if (!leaf.tabs.some((t) => t.id === tabId)) return leaf;
    if (leaf.activeTabId === tabId) return leaf;
    return { ...leaf, activeTabId: tabId };
  });
}

// ── Split operations ────────────────────────────────────────────

export interface SplitResult {
  root: EditorNode;
  newLeafId: string;
}

export function splitLeafWithTab(
  root: EditorNode,
  leafId: string,
  direction: 'left' | 'right' | 'top' | 'bottom',
  tab: InspectorTab,
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

export function unsplitLeaf(root: EditorNode, leafId: string): EditorNode {
  const link = parentPath(root, leafId)?.[0];
  if (!link) return root;
  const { parent, side } = link;
  const self = side === 'a' ? (parent.a as EditorLeaf) : (parent.b as EditorLeaf);
  const other = side === 'a' ? parent.b : parent.a;

  const mergedTabs: InspectorTab[] = [...self.tabs];
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

export function unsplitAll(root: EditorNode, survivingLeafId?: string): EditorNode {
  const leaves = allLeaves(root);
  const tabs: InspectorTab[] = [];
  for (const leaf of leaves) {
    for (const t of leaf.tabs) {
      if (!tabs.some((x) => x.id === t.id)) tabs.push(t);
    }
  }
  const keepId = survivingLeafId && leaves.some((l) => l.id === survivingLeafId) ? survivingLeafId : leaves[0].id;
  const keep = leaves.find((l) => l.id === keepId) ?? leaves[0];
  return { kind: 'leaf', id: keepId, tabs, activeTabId: keep.activeTabId ?? tabs[0]?.id ?? null };
}

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

export function findOppositeLeaf(root: EditorNode, leafId: string): EditorLeaf | null {
  const link = parentPath(root, leafId)?.[0];
  if (!link) return null;
  const sibling = link.side === 'a' ? link.parent.b : link.parent.a;
  return firstLeaf(sibling);
}

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

  const afterRemove = removeTabFromLeaf(root, fromLeafId, tabId);
  return insertTabIntoLeaf(afterRemove, toLeafId, tab, insertAt);
}

/** Empty a leaf in place (keep the leaf itself). */
export function removeAllFromLeaf(root: EditorNode, leafId: string): EditorNode {
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
