/**
 * Ref-rail tree shaping for the Git tool window — the log-window left
 * rail: inside each namespace group (Local / Remote / Tags) ref names
 * fold on `/` into collapsible folders (`v5/data-model` renders as
 * folder `v5` → leaf `data-model`; a remote's first segment is its
 * remote-name folder). Inside a level the refs that lead come first
 * (the checked-out branch, then the favorites — the reference's
 * order), then the folders, then every other ref by name. Pure shaping
 * + search filtering; selection and expansion state stay with the view.
 */

import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';

export interface RefTreeFolder {
  kind: 'folder';
  label: string;
  /** Stable key: `<group>:<path>` — the expansion-state handle. */
  key: string;
  children: RefTreeNode[];
}

export interface RefTreeLeaf {
  kind: 'leaf';
  label: string;
  /** Full ref name — the log-scope argument. */
  name: string;
  refKind: WorkspaceTreeRefWire['kind'];
}

export type RefTreeNode = RefTreeFolder | RefTreeLeaf;

/** Where a ref stands in its level: the checked-out branch, a favorite, any other. */
export type RefRank = 'current' | 'favorite' | 'plain';

const RANK_ORDER: Record<RefRank, number> = { current: 0, favorite: 1, plain: 2 };

interface BuildLeaf {
  label: string;
  name: string;
  refKind: WorkspaceTreeRefWire['kind'];
  rank: RefRank;
}

interface BuildFolder {
  folders: Map<string, BuildFolder>;
  leaves: BuildLeaf[];
}

const byRankThenLabel = (a: BuildLeaf, b: BuildLeaf): number =>
  RANK_ORDER[a.rank] - RANK_ORDER[b.rank] || a.label.localeCompare(b.label);

const leafNode = (leaf: BuildLeaf): RefTreeLeaf => ({
  kind: 'leaf',
  label: leaf.label,
  name: leaf.name,
  refKind: leaf.refKind,
});

function newBuildFolder(): BuildFolder {
  return { folders: new Map(), leaves: [] };
}

function emit(dir: BuildFolder, groupKind: string, prefix: string): RefTreeNode[] {
  const leaves = [...dir.leaves].sort(byRankThenLabel);
  const nodes: RefTreeNode[] = leaves.filter((leaf) => leaf.rank !== 'plain').map(leafNode);
  for (const [name, child] of [...dir.folders.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const path = prefix === '' ? name : `${prefix}/${name}`;
    nodes.push({ kind: 'folder', label: name, key: `${groupKind}:${path}`, children: emit(child, groupKind, path) });
  }
  nodes.push(...leaves.filter((leaf) => leaf.rank === 'plain').map(leafNode));
  return nodes;
}

/**
 * Fold one namespace group's refs into its folder tree. With
 * `groupByDirectory` off (the log-window gear toggle) the group stays a
 * flat sorted list — every ref a leaf labeled by its full name.
 * `rankOf` says which refs lead their level; absent, none does.
 */
export function buildRefTree(
  refs: readonly WorkspaceTreeRefWire[],
  groupKind: string,
  groupByDirectory = true,
  rankOf: (ref: WorkspaceTreeRefWire) => RefRank = () => 'plain',
): RefTreeNode[] {
  if (!groupByDirectory) {
    return refs
      .map((ref): BuildLeaf => ({ label: ref.name, name: ref.name, refKind: ref.kind, rank: rankOf(ref) }))
      .sort(byRankThenLabel)
      .map(leafNode);
  }
  const root = newBuildFolder();
  for (const ref of refs) {
    const segments = ref.name.split('/').filter((segment) => segment.length > 0);
    if (segments.length === 0) continue;
    let dir = root;
    for (const segment of segments.slice(0, -1)) {
      let child = dir.folders.get(segment);
      if (child === undefined) {
        child = newBuildFolder();
        dir.folders.set(segment, child);
      }
      dir = child;
    }
    dir.leaves.push({ label: segments[segments.length - 1], name: ref.name, refKind: ref.kind, rank: rankOf(ref) });
  }
  return emit(root, groupKind, '');
}

/**
 * Prune the tree to leaves whose full ref name contains `needle`
 * (case-insensitive); folders survive only while they still hold a
 * match. An empty needle answers the tree untouched.
 */
export function filterRefTree(nodes: readonly RefTreeNode[], needle: string): RefTreeNode[] {
  const trimmed = needle.trim().toLowerCase();
  if (trimmed === '') return [...nodes];
  const filtered: RefTreeNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'leaf') {
      if (node.name.toLowerCase().includes(trimmed)) filtered.push(node);
      continue;
    }
    const children = filterRefTree(node.children, trimmed);
    if (children.length > 0) filtered.push({ ...node, children });
  }
  return filtered;
}

/** Folder keys on the path to `refName` — the default-expansion feed
 *  (the current branch's ancestry starts open, the rest collapsed). */
export function folderKeysToRef(refName: string, groupKind: string): string[] {
  const segments = refName.split('/').filter((segment) => segment.length > 0);
  const keys: string[] = [];
  let path = '';
  for (const segment of segments.slice(0, -1)) {
    path = path === '' ? segment : `${path}/${segment}`;
    keys.push(`${groupKind}:${path}`);
  }
  return keys;
}

/** Every folder key in a filtered tree — search results render fully open. */
export function allFolderKeys(nodes: readonly RefTreeNode[]): string[] {
  const keys: string[] = [];
  for (const node of nodes) {
    if (node.kind !== 'folder') continue;
    keys.push(node.key);
    keys.push(...allFolderKeys(node.children));
  }
  return keys;
}
