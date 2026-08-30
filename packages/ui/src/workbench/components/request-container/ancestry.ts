/**
 * Renderer-side request-tree ancestry — a folder's owning collection, a
 * request's collection + folder chain, and the ancestor auth resolution
 * the request editor's Authorization tab shows under Inherit ("Bearer
 * Token — from Collection ‘Payments’"), mirroring the executor's rule: the INNERMOST
 * carrier whose `auth` is present and not itself `inherit` wins (folder
 * beats collection), `none` is a real carrier, an absent field is
 * transparent, no carrier at all = no auth.
 *
 * Ancestry is read off the collection TREES — the projection of the
 * parent-owned child slots — never off a leaf's stored `path`: a leaf
 * mirror's path is stale after a drag (the tree containment law), the
 * tree is not.
 */

import type { AuthConfig, Collection, CollectionTree, TreeNode } from '@openheaders/core/types';

export interface AncestorAuthCarrier {
  uid: string;
  name: string;
  auth?: AuthConfig;
}

export interface RequestAncestry {
  collection: Collection;
  /** Outer → inner. */
  folders: AncestorAuthCarrier[];
}

export interface InheritedAuthSource {
  kind: 'collection' | 'folder';
  name: string;
}

export interface ResolvedInheritedAuth {
  /** The effective config under Inherit — `{ type: 'none' }` when no
   *  ancestor carries one. */
  auth: AuthConfig;
  /** The level that supplied it; `null` when nothing is set anywhere
   *  above the request. */
  source: InheritedAuthSource | null;
}

function folderChainTo(nodes: readonly TreeNode[], requestUid: string, chain: string[]): string[] | null {
  for (const node of nodes) {
    if (node.type === 'folder') {
      const found = folderChainTo(node.children, requestUid, [...chain, node.uid]);
      if (found) return found;
      continue;
    }
    if (node.uid === requestUid) return chain;
  }
  return null;
}

/**
 * The request's owning collection and folder chain (outer → inner),
 * read off the trees; `null` when the request sits in no tree (a
 * scratch draft, or a tree still hydrating).
 */
export function findRequestAncestry(
  trees: readonly CollectionTree[],
  collections: readonly Collection[],
  folders: readonly AncestorAuthCarrier[],
  requestUid: string,
): RequestAncestry | null {
  for (const tree of trees) {
    const chain = folderChainTo(tree.tree, requestUid, []);
    if (chain === null) continue;
    const collection = collections.find((c) => c.uid === tree.uid);
    if (!collection) return null;
    const carriers: AncestorAuthCarrier[] = [];
    for (const uid of chain) {
      const folder = folders.find((f) => f.uid === uid);
      if (folder) carriers.push(folder);
    }
    return { collection, folders: carriers };
  }
  return null;
}

/** The collection a folder belongs to, read off the trees; `null` when
 *  no tree holds the folder. */
export function findFolderCollectionUid(trees: readonly CollectionTree[], folderUid: string): string | null {
  const holds = (nodes: readonly TreeNode[]): boolean =>
    nodes.some((node) => node.type === 'folder' && (node.uid === folderUid || holds(node.children)));
  for (const tree of trees) {
    if (holds(tree.tree)) return tree.uid;
  }
  return null;
}

/** Resolve what a request set to Inherit sends with, and from where. */
export function resolveInheritedAuthFor(ancestry: RequestAncestry | null): ResolvedInheritedAuth {
  if (ancestry === null) return { auth: { type: 'none' }, source: null };
  for (let i = ancestry.folders.length - 1; i >= 0; i--) {
    const folder = ancestry.folders[i];
    if (folder.auth !== undefined && folder.auth.type !== 'inherit') {
      return { auth: folder.auth, source: { kind: 'folder', name: folder.name } };
    }
  }
  const { auth, name } = ancestry.collection;
  if (auth !== undefined && auth.type !== 'inherit') {
    return { auth, source: { kind: 'collection', name } };
  }
  return { auth: { type: 'none' }, source: null };
}
