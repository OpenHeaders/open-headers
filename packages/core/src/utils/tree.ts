/**
 * Tree navigation utilities — shared between desktop and extension.
 *
 * Pure functions for navigating V5 CollectionTree structures:
 *   - Finding children at a given folder path
 *   - Building breadcrumb trails from root to a target folder
 *
 * Used by the SaveToCollectionModal in both apps.
 */

import type { FolderNode, TreeNode } from '../types/v5/collection';

/**
 * Find the children of a folder at `folderPath` within a tree.
 * Returns the folder's children array, or null if not found.
 * If `folderPath` is undefined, returns the top-level nodes.
 */
export function findNodeChildren(tree: TreeNode[], folderPath: string | undefined): TreeNode[] | null {
  if (!folderPath) return tree;

  for (const node of tree) {
    if (node.type !== 'folder') continue;
    if (node.path === folderPath) return node.children;
    const found = findNodeChildren(node.children, folderPath);
    if (found !== null) return found;
  }

  return null;
}

/**
 * Build the breadcrumb trail from the tree root to `targetPath`.
 * Returns an array of { name, path } segments in order from root to target.
 * Returns empty array if targetPath is undefined or not found.
 */
export function buildBreadcrumbTrail(
  tree: TreeNode[],
  targetPath: string | undefined,
): Array<{ name: string; path: string }> {
  if (!targetPath) return [];

  const trail: Array<{ name: string; path: string }> = [];

  function walk(nodes: TreeNode[]): boolean {
    for (const node of nodes) {
      if (node.type !== 'folder') continue;
      trail.push({ name: node.name, path: node.path });
      if (node.path === targetPath) return true;
      if (walk(node.children)) return true;
      trail.pop();
    }
    return false;
  }

  walk(tree);
  return trail;
}
