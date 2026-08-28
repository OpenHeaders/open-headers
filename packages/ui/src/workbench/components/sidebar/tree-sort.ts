/**
 * Sidebar sort view — "order is data, sort is view". The manual order
 * is shared workspace data; *Name* is a local display sort over the
 * same trees: collections by name, and inside every container folders
 * by name then leaves by name (folders stay first). Nothing here
 * touches the data order; the sidebar applies it to the trees it
 * renders and disables drag while it is active.
 */

import type { CollectionTree, TreeNode } from '@openheaders/core/types';

export const SIDEBAR_SORT_MODES = ['manual', 'name'] as const;
export type SidebarSortMode = (typeof SIDEBAR_SORT_MODES)[number];

const byName = <T extends { name: string }>(a: T, b: T): number =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

function sortChildren(nodes: readonly TreeNode[]): TreeNode[] {
  const folders: TreeNode[] = [];
  const leaves: TreeNode[] = [];
  for (const node of nodes) (node.type === 'folder' ? folders : leaves).push(node);
  return [
    ...folders
      .sort(byName)
      .map((folder) => (folder.type === 'folder' ? { ...folder, children: sortChildren(folder.children) } : folder)),
    ...leaves.sort(byName),
  ];
}

export function sortCollectionTreesByName(trees: readonly CollectionTree[]): CollectionTree[] {
  return [...trees].sort(byName).map((collection) => ({ ...collection, tree: sortChildren(collection.tree) }));
}

/** The trees as the sidebar renders them under `mode`. */
export function applySidebarSort(trees: readonly CollectionTree[], mode: SidebarSortMode): readonly CollectionTree[] {
  return mode === 'name' ? sortCollectionTreesByName(trees) : trees;
}
