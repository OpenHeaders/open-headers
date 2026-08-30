/**
 * Renderer-side request-tree ancestry — a folder's owning collection, a
 * request's collection + folder chain, and the inherited-auth
 * attribution the request editor's Authorization tab shows under
 * Inherit ("Bearer Token — from Collection ‘Payments’"). The RULE is
 * the shared one (`@openheaders/core/auth-inheritance`) — the same
 * resolution the executor runs; only the chain derivation is the
 * renderer's: read off the collection TREES (the projection of the
 * parent-owned child slots), never off a leaf's stored `path` — a leaf
 * mirror's path is stale after a drag (the tree containment law), the
 * tree is not.
 */

import { type AuthCarrier, hostOf, resolveInheritedAuth } from '@openheaders/core/auth-inheritance';
import type {
  AuthConfig,
  AuthPoolEntry,
  Collection,
  CollectionTree,
  ConcreteAuthConfig,
  TreeNode,
} from '@openheaders/core/types';

export interface AncestorAuthCarrier {
  uid: string;
  name: string;
  auths?: AuthPoolEntry[];
  defaultAuthUid?: string;
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
  /** The pool entry's label; empty = the type's label. */
  entryName: string;
}

export interface ResolvedInheritedAuth {
  /** The effective config under Inherit — `{ type: 'none' }` when no
   *  ancestor holds a pool. */
  auth: ConcreteAuthConfig;
  /** The level that supplied it; `null` when nothing is set anywhere
   *  above the request. */
  source: InheritedAuthSource | null;
  /** The request named a pool entry that no longer exists. */
  danglingAuthUid?: string;
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

/** The ancestry as the shared rule's chain (outer → inner). */
export function authChainOf(ancestry: RequestAncestry): AuthCarrier[] {
  const { collection } = ancestry;
  return [
    {
      level: 'collection',
      uid: collection.uid,
      name: collection.name,
      auths: collection.auths,
      defaultAuthUid: collection.defaultAuthUid,
      auth: collection.auth,
    },
    ...ancestry.folders.map(
      (f): AuthCarrier => ({
        level: 'folder',
        uid: f.uid,
        name: f.name,
        auths: f.auths,
        defaultAuthUid: f.defaultAuthUid,
        auth: f.auth,
      }),
    ),
  ];
}

/**
 * Resolve what a request set to Inherit sends with, and from where —
 * the shared rule over the tree-read chain. `pick` is the request's
 * Inherit config (a named entry or the default); `url` the request's
 * URL for host-scoped entries.
 */
export function resolveInheritedAuthFor(
  ancestry: RequestAncestry | null,
  pick: { authUid?: string } = {},
  url = '',
): ResolvedInheritedAuth {
  if (ancestry === null) return { auth: { type: 'none' }, source: null };
  const resolved = resolveInheritedAuth(authChainOf(ancestry), pick, hostOf(url));
  return {
    auth: resolved.auth,
    source:
      resolved.source === null
        ? null
        : { kind: resolved.source.level, name: resolved.source.name, entryName: resolved.source.entryName },
    ...(resolved.danglingAuthUid !== undefined ? { danglingAuthUid: resolved.danglingAuthUid } : {}),
  };
}
