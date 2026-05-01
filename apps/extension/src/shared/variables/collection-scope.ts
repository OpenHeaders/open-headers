/**
 * Collection-scope helpers for the variable resolver — shared across
 * every renderer + SW surface that needs to feed variables, look up
 * the owning collection of an entity, or pick the active collection
 * for a tab.
 *
 * Three collection families share the same `V5.Collection` shape and
 * each carries its own `variables: V5.Variable[]`:
 *   - rule collections      (`useRules().localCollections`           / `getCollections()`)
 *   - request collections   (`useRequests().collections`             / `getRequestCollections()`)
 *   - template collections  (`useRules().templateCollections`        / `getTemplateCollections()`)
 *
 * The `VariableResolver` keys `collectionVariables` by uid; uids are
 * minted from one pool and never collide across families, so a single
 * Map keyed by uid is correct. Callers don't need to know which family
 * a collectionId came from at resolution time — `ResolutionContext
 * .collectionId` resolves through the merged map regardless.
 *
 * The lookup helpers exist because INFERRING the right collection for a
 * given entity does need family awareness:
 *   - rules    live under one of the rule collection paths
 *   - requests live under one of the request collection paths
 *   - templates live under one of the template collection paths
 *
 * Mixing families on path-prefix lookup (the pre-session-49 bug) returns
 * null for a request whose path starts with `requests/` against a list
 * of `rules/...` collections, so the resolver's collection scope was
 * silently empty for every request and template surface.
 */

import type { V5 } from '@openheaders/core/types';
import type { VariableResolver } from '@openheaders/core/variables';

/** Bundle of all three collection families. Pass once, reuse everywhere. */
export interface CollectionFamilies {
  ruleCollections: readonly V5.Collection[];
  requestCollections: readonly V5.Collection[];
  templateCollections: readonly V5.Collection[];
}

/** Find a collection by uid across all three families. */
export function findCollectionByUid(uid: string, families: CollectionFamilies): V5.Collection | null {
  return (
    families.ruleCollections.find((c) => c.uid === uid) ??
    families.requestCollections.find((c) => c.uid === uid) ??
    families.templateCollections.find((c) => c.uid === uid) ??
    null
  );
}

/**
 * Find a collection by uid AND identify which family it belongs to.
 * Used by surfaces (e.g., the Inspector's Open-Editor CTA) that need to
 * dispatch to the per-family variables-editor opener — the rule, request,
 * and template variants are three distinct tab modes, so the family
 * is the dispatch key.
 */
export function findCollectionWithFamily(
  uid: string,
  families: CollectionFamilies,
): { family: CollectionFamily; collection: V5.Collection } | null {
  const PAIRS: { family: CollectionFamily; list: readonly V5.Collection[] }[] = [
    { family: 'rule', list: families.ruleCollections },
    { family: 'request', list: families.requestCollections },
    { family: 'template', list: families.templateCollections },
  ];
  for (const { family, list } of PAIRS) {
    const collection = list.find((c) => c.uid === uid);
    if (collection) return { family, collection };
  }
  return null;
}

/**
 * Find the collection whose `path/` is a prefix of `entityPath`. Each
 * family is checked independently so a request's `requests/X/...` path
 * never matches a rule collection at `rules/X/...` even if the names
 * collide. Returns the longest-prefix match within the chosen family
 * (defensive — current paths are flat, but a future nested-collections
 * design would lean on this).
 */
export function findCollectionByPath(
  entityPath: string,
  families: CollectionFamilies,
): V5.Collection | null {
  for (const candidates of [
    families.ruleCollections,
    families.requestCollections,
    families.templateCollections,
  ]) {
    let best: V5.Collection | null = null;
    for (const c of candidates) {
      if (!entityPath.startsWith(`${c.path}/`)) continue;
      if (!best || c.path.length > best.path.length) best = c;
    }
    if (best) return best;
  }
  return null;
}

/**
 * Push every family's variables into the resolver's collection-scope
 * map. Idempotent — re-feeding the same uid overwrites in place. Drops
 * uids that are no longer present in any family so a deleted collection
 * doesn't keep resolving stale values; pass `previousUids` from the
 * caller's last sync pass for the diff.
 */
export function feedCollectionVariablesToResolver(
  resolver: VariableResolver,
  families: CollectionFamilies,
  previousUids?: ReadonlySet<string>,
): Set<string> {
  const liveUids = new Set<string>();
  for (const family of [families.ruleCollections, families.requestCollections, families.templateCollections]) {
    for (const c of family) {
      resolver.setCollectionVariables(c.uid, c.variables ?? []);
      liveUids.add(c.uid);
    }
  }
  if (previousUids) {
    for (const uid of previousUids) {
      if (!liveUids.has(uid)) resolver.removeCollectionVariables(uid);
    }
  }
  return liveUids;
}

/** Iterate every collection across all families. Used for "all collections" displays. */
export function* iterateAllCollections(families: CollectionFamilies): Generator<V5.Collection> {
  for (const c of families.ruleCollections) yield c;
  for (const c of families.requestCollections) yield c;
  for (const c of families.templateCollections) yield c;
}

/** Which collection family owns a given folder. */
export type CollectionFamily = 'rule' | 'request' | 'template';

/** Bundle of all three families' collection trees — the per-tree counterpart
 * to {@link CollectionFamilies}. Folder lookup needs trees because folders
 * live as `V5.FolderNode` entries inside `V5.CollectionTree.tree`, not on
 * the flat `Collection` objects. */
export interface CollectionTreeFamilies {
  ruleTrees: readonly V5.CollectionTree[];
  requestTrees: readonly V5.CollectionTree[];
  templateTrees: readonly V5.CollectionTree[];
}

/**
 * Find a folder by uid across all three families. Returns the family that
 * owns it plus enough context (collection uid + name + folder trail) for
 * a renderer to mount the right per-family overview component and show
 * the right breadcrumb.
 *
 * Folder uids — like collection uids — are minted globally unique, so a
 * single uid disambiguates the family. The walk visits families in a
 * fixed order (rule → request → template) and returns the first match;
 * a uid present in two families would be a minting bug, not a lookup
 * concern, and the helper's tests cover the no-collision invariant.
 */
export function findFolderByUid(
  folderUid: string,
  families: CollectionTreeFamilies,
): {
  family: CollectionFamily;
  folder: V5.FolderNode;
  collectionUid: string;
  collectionName: string;
  /** Folder names from the owning collection root down to (but excluding)
   *  the folder itself. Empty when the folder is a direct child of the
   *  collection. Useful for breadcrumb construction. */
  folderTrail: string[];
} | null {
  const FAMILIES: { family: CollectionFamily; trees: readonly V5.CollectionTree[] }[] = [
    { family: 'rule', trees: families.ruleTrees },
    { family: 'request', trees: families.requestTrees },
    { family: 'template', trees: families.templateTrees },
  ];
  for (const { family, trees } of FAMILIES) {
    for (const col of trees) {
      const trail: string[] = [];
      const walk = (nodes: V5.TreeNode[]): V5.FolderNode | null => {
        for (const n of nodes) {
          if (n.type !== 'folder') continue;
          if (n.uid === folderUid) return n;
          trail.push(n.name);
          const found = walk(n.children);
          if (found) return found;
          trail.pop();
        }
        return null;
      };
      const folder = walk(col.tree);
      if (folder) {
        return { family, folder, collectionUid: col.uid, collectionName: col.name, folderTrail: trail };
      }
    }
  }
  return null;
}
