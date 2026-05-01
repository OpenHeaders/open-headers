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
