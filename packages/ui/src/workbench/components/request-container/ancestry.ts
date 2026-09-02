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

import {
  type AuthCarrier,
  authPoolOf,
  hostOf,
  LEGACY_AUTH_ENTRY_UID,
  resolveInheritedAuth,
} from '@openheaders/core/auth-inheritance';
import type { ScriptKind, ScriptSlotCarrier } from '@openheaders/core/scripts';
import { readScriptSlot, SCRIPT_KINDS } from '@openheaders/core/scripts';
import type {
  AuthConfig,
  AuthPoolEntry,
  Collection,
  CollectionTree,
  ConcreteAuthConfig,
  TreeNode,
} from '@openheaders/core/types';

/** A container as the renderer's ancestry reads it — the auth pool and
 *  the script slots (`ScriptSlotCarrier`: the HTTP pair and the session
 *  record) the Scripts tab's "Runs after …" line names. */
export interface AncestorAuthCarrier extends ScriptSlotCarrier {
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

/** The renderer snapshot the page-session factories derive a leaf's
 *  ancestry from — the TREES (the containment projection) plus the
 *  container mirrors; never a leaf's stored path. */
export interface RequestAncestryInputs {
  collectionTrees: readonly CollectionTree[];
  collections: readonly Collection[];
  folders: readonly AncestorAuthCarrier[];
}

export interface InheritedAuthSource {
  kind: 'collection' | 'folder';
  /** The supplying container's uid — the "Edit in …" opener's target. */
  uid: string;
  name: string;
  entryUid: string;
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
        : {
            kind: resolved.source.level,
            uid: resolved.source.uid,
            name: resolved.source.name,
            entryUid: resolved.source.entryUid,
            entryName: resolved.source.entryName,
          },
    ...(resolved.danglingAuthUid !== undefined ? { danglingAuthUid: resolved.danglingAuthUid } : {}),
  };
}

export interface InheritPoolLevel {
  kind: 'collection' | 'folder';
  uid: string;
  name: string;
  /** The level's pickable entries — the legacy single-auth read is
   *  default-only (its uid is reserved), so it never lists. */
  entries: AuthPoolEntry[];
  defaultUid: string;
}

/**
 * The ancestor levels holding a pool, inner → outer — the request
 * select's Inherited group. A level whose only entry is the legacy
 * read has nothing pickable and is skipped.
 */
export function inheritPoolLevels(ancestry: RequestAncestry | null): InheritPoolLevel[] {
  if (ancestry === null) return [];
  const levels: InheritPoolLevel[] = [];
  const chain = authChainOf(ancestry);
  for (let i = chain.length - 1; i >= 0; i--) {
    const carrier = chain[i];
    const pool = authPoolOf(carrier);
    if (pool === null) continue;
    const entries = pool.entries.filter((e) => e.uid !== LEGACY_AUTH_ENTRY_UID);
    if (entries.length === 0) continue;
    levels.push({ kind: carrier.level, uid: carrier.uid, name: carrier.name, entries, defaultUid: pool.defaultUid });
  }
  return levels;
}

export interface AncestorScriptLevel {
  kind: 'collection' | 'folder';
  uid: string;
  name: string;
}

/** Per slot kind, the levels carrying a script — outer → inner, the
 *  order they run in ahead of the request's own. A kind with no level
 *  is absent. */
export type AncestorScriptLevels = Partial<Readonly<Record<ScriptKind, AncestorScriptLevel[]>>>;

/**
 * The ancestor levels whose script slots run around the request, per
 * kind, outer → inner — the renderer twin of the executor's slot
 * chain composition (whitespace-only slots skipped). Empty for a
 * scratch draft.
 */
export function ancestorScriptLevels(ancestry: RequestAncestry | null): AncestorScriptLevels {
  if (ancestry === null) return {};
  const levels: Array<[AncestorScriptLevel['kind'], AncestorAuthCarrier]> = [
    ['collection', ancestry.collection],
    ...ancestry.folders.map((f): [AncestorScriptLevel['kind'], AncestorAuthCarrier] => ['folder', f]),
  ];
  const out: Partial<Record<ScriptKind, AncestorScriptLevel[]>> = {};
  for (const kind of SCRIPT_KINDS) {
    const carrying = levels.filter(([, carrier]) => (readScriptSlot(carrier, kind) ?? '').trim() !== '');
    if (carrying.length === 0) continue;
    out[kind] = carrying.map(([level, carrier]) => ({ kind: level, uid: carrier.uid, name: carrier.name }));
  }
  return out;
}

/**
 * A folder's own ancestry — its owning collection and the folders
 * above it (outer → inner, the folder itself excluded), read off the
 * trees; `null` when no tree holds the folder.
 */
export function findFolderAncestry(
  trees: readonly CollectionTree[],
  collections: readonly Collection[],
  folders: readonly AncestorAuthCarrier[],
  folderUid: string,
): RequestAncestry | null {
  const chainTo = (nodes: readonly TreeNode[], chain: string[]): string[] | null => {
    for (const node of nodes) {
      if (node.type !== 'folder') continue;
      if (node.uid === folderUid) return chain;
      const found = chainTo(node.children, [...chain, node.uid]);
      if (found) return found;
    }
    return null;
  };
  for (const tree of trees) {
    const chain = chainTo(tree.tree, []);
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

export interface NearestAuthPool {
  kind: 'collection' | 'folder';
  uid: string;
  name: string;
  entries: readonly AuthPoolEntry[];
  defaultUid: string;
}

/**
 * The nearest ancestor holding a pool (inner → outer) — what a
 * transparent folder inherits and shows read-only. The legacy
 * single-auth read counts (it is the default a request resolves to).
 * `null` when nothing is set anywhere above.
 */
export function nearestAuthPool(ancestry: RequestAncestry | null): NearestAuthPool | null {
  if (ancestry === null) return null;
  const chain = authChainOf(ancestry);
  for (let i = chain.length - 1; i >= 0; i--) {
    const carrier = chain[i];
    const pool = authPoolOf(carrier);
    if (pool === null) continue;
    return {
      kind: carrier.level,
      uid: carrier.uid,
      name: carrier.name,
      entries: pool.entries,
      defaultUid: pool.defaultUid,
    };
  }
  return null;
}
