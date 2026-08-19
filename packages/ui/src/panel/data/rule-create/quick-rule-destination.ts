/**
 * Destination heuristic for the quick-create popovers. Rules created
 * from the panel should land somewhere organized, not pile up at a
 * collection root — so the default destination is a folder named after
 * the captured URL's registrable domain (`openheaders.com`), inside the
 * first local collection, created on demand and shared by every later
 * quick-created rule for that domain. The popover shows the plan and
 * lets the user override collection and folder before Save.
 *
 * Pure module: the resolve is (url, trees, override) → plan, so the
 * heuristic re-derives from live trees on every render — if another
 * save minted the domain folder meanwhile, the plan flips from "mint"
 * to "reuse" on its own (derived, never imperative).
 */

import type { CollectionTree, TreeNode } from '@openheaders/core/types';
import { registrableDomain } from '@openheaders/core/utils';

/** Registrable-domain heuristic, lifted to core and shared with the
 *  sessions archive's auto-placement — see `registrableDomain` in
 *  `@openheaders/core/utils`. */
export function domainFolderName(url: string): string | null {
  return registrableDomain(url);
}

/** Folder selection in the picker: follow the domain heuristic, pin the
 *  collection root, or pin an existing folder by path. */
export type QuickFolderChoice = { kind: 'auto' } | { kind: 'root' } | { kind: 'folder'; path: string };

export interface QuickDestinationOverride {
  collectionUid?: string;
  folder: QuickFolderChoice;
}

export interface QuickDestinationPlan {
  /** Chosen collection — null when the workspace has none yet (Save
   *  mints the default collection first). */
  collection: { uid: string; path: string; name: string } | null;
  /** Existing folder the rule lands in. */
  folderPath: string | null;
  /** Folder minted at save time under the collection root. */
  newFolderName: string | null;
  /** Display label for the folder segment (existing name or the
   *  to-be-minted domain); null = collection root. */
  folderLabel: string | null;
}

export interface QuickFolderOption {
  path: string;
  name: string;
  depth: number;
}

/** Flatten a collection tree's folders (depth-first) for the picker. */
export function listFolderOptions(tree: readonly TreeNode[], depth = 0): QuickFolderOption[] {
  const out: QuickFolderOption[] = [];
  for (const node of tree) {
    if (node.type !== 'folder') continue;
    out.push({ path: node.path, name: node.name, depth });
    out.push(...listFolderOptions(node.children, depth + 1));
  }
  return out;
}

function findTopLevelFolder(tree: readonly TreeNode[], name: string): TreeNode | null {
  for (const node of tree) {
    if (node.type === 'folder' && node.name === name) return node;
  }
  return null;
}

export function resolveQuickDestination(
  url: string | undefined,
  trees: readonly CollectionTree[],
  override: QuickDestinationOverride | null,
): QuickDestinationPlan {
  const collectionTree =
    (override?.collectionUid ? trees.find((t) => t.uid === override.collectionUid) : undefined) ?? trees[0] ?? null;
  const collection = collectionTree
    ? { uid: collectionTree.uid, path: collectionTree.path, name: collectionTree.name }
    : null;

  const choice: QuickFolderChoice = override?.folder ?? { kind: 'auto' };
  if (choice.kind === 'root') {
    return { collection, folderPath: null, newFolderName: null, folderLabel: null };
  }
  if (choice.kind === 'folder') {
    const options = collectionTree ? listFolderOptions(collectionTree.tree) : [];
    const picked = options.find((f) => f.path === choice.path);
    // A folder deleted since it was picked degrades to the root.
    if (!picked) return { collection, folderPath: null, newFolderName: null, folderLabel: null };
    return { collection, folderPath: picked.path, newFolderName: null, folderLabel: picked.name };
  }

  // Auto: reuse the collection's top-level domain folder, else mint it.
  const domain = url ? domainFolderName(url) : null;
  if (!domain) return { collection, folderPath: null, newFolderName: null, folderLabel: null };
  const existing = collectionTree ? findTopLevelFolder(collectionTree.tree, domain) : null;
  if (existing) return { collection, folderPath: existing.path, newFolderName: null, folderLabel: domain };
  return { collection, folderPath: null, newFolderName: domain, folderLabel: domain };
}
