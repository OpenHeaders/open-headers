/**
 * Collection/folder pause utilities — closest-specifier override model.
 *
 * Pause markers are keyed by CONTAINER IDENTITY — the collection or
 * folder uid — never by path: a marker follows its folder wherever the
 * folder moves (tree containment plan, slice 4). An 'unpaused' marker
 * is an explicit override that wins over an ancestor 'paused' marker —
 * the same shape as `.gitignore` (`!pattern`), uBlock exception rules,
 * or LaunchDarkly env-over-org cascades.
 *
 * Resolution walks the parent chain (self → folder → … → collection);
 * the first node with any marker decides. Default is unpaused. The
 * sidebar trees already ARE the parent chain, so tree consumers fold
 * the state top-down in one pass (`computePausedUids`); consumers that
 * hold a chain but no tree resolve through `resolvePauseState`.
 */

import type { CollectionTree, TreeNode } from '../types/collection';

export type PauseMarker = 'paused' | 'unpaused';

/** The container kinds a marker can sit on — the rules tree's two entity types as spelled in code. */
export type PauseMarkerContainerType = 'collection' | 'folder';

export interface PauseMarkerRef {
  type: PauseMarkerContainerType;
  uid: string;
}

/**
 * One marker as stored, projected and persisted. `path` is a write-time
 * hint for 2026.8.4 readers whose projector keys markers by path; it is
 * never read by uid-keyed consumers and goes stale on a move by design.
 */
export interface PauseMarkerEntry extends PauseMarkerRef {
  marker: PauseMarker;
  path?: string;
}

/** Read-only view of the marker map, keyed by container uid — pass this around in render code. */
export type PauseMarkers = ReadonlyMap<string, PauseMarker>;

/** The set of every uid — container or leaf — effectively paused after resolution. */
export type PausedUids = ReadonlySet<string>;

/** Persisted + post-state shape: the uid-keyed map beside the full entries. */
export interface PauseMarkersRecord {
  markers: Record<string, PauseMarker>;
  entries: PauseMarkerEntry[];
}

export function pauseMarkersFromEntries(entries: readonly PauseMarkerEntry[]): Map<string, PauseMarker> {
  const out = new Map<string, PauseMarker>();
  for (const entry of entries) out.set(entry.uid, entry.marker);
  return out;
}

/**
 * Resolve the effective pause state of a node by walking its parent
 * chain: `parentOf(uid)` yields the parent container's uid, or `null`
 * at a collection root. The first marker hit decides; no marker on the
 * chain means unpaused.
 */
export function resolvePauseState(
  uid: string,
  markers: PauseMarkers,
  parentOf: (uid: string) => string | null,
): boolean {
  if (markers.size === 0) return false;
  const visited = new Set<string>();
  let current: string | null = uid;
  while (current !== null && !visited.has(current)) {
    visited.add(current);
    const marker = markers.get(current);
    if (marker === 'paused') return true;
    if (marker === 'unpaused') return false;
    current = parentOf(current);
  }
  return false;
}

/**
 * Whether any container strictly inside `children` carries a marker
 * (paused or unpaused override). Drives the conditional "Clear Nested
 * Overrides" menu entry — surfaced only when the user has explicit
 * markers below this node that the regular self-action wouldn't touch.
 */
export function hasNestedPauseMarkers(children: readonly TreeNode[], markers: PauseMarkers): boolean {
  if (markers.size === 0) return false;
  for (const node of children) {
    if (node.type !== 'folder') continue;
    if (markers.has(node.uid) || hasNestedPauseMarkers(node.children, markers)) return true;
  }
  return false;
}

/** Every folder uid strictly inside `children`, depth-first. */
export function collectNestedContainerUids(children: readonly TreeNode[], out: string[] = []): string[] {
  for (const node of children) {
    if (node.type !== 'folder') continue;
    out.push(node.uid);
    collectNestedContainerUids(node.children, out);
  }
  return out;
}

/**
 * Walk every collection tree and collect the uids of nodes that are
 * effectively paused under `markers`. One pass, with state inherited
 * down the tree so per-node lookups are O(1) instead of O(depth).
 * Override markers ('unpaused') flip the inherited state inside their
 * own subtree.
 */
export function computePausedUids(trees: readonly CollectionTree[], markers: PauseMarkers): Set<string> {
  const out = new Set<string>();
  if (markers.size === 0) return out;

  const walk = (nodes: readonly TreeNode[], inherited: boolean): void => {
    for (const node of nodes) {
      const marker = markers.get(node.uid);
      const effective = marker === 'paused' ? true : marker === 'unpaused' ? false : inherited;
      if (effective) out.add(node.uid);
      if (node.type === 'folder') walk(node.children, effective);
    }
  };

  for (const col of trees) {
    const marker = markers.get(col.uid);
    // Top-level: nothing to inherit from, default false.
    const effective = marker === 'paused';
    if (effective) out.add(col.uid);
    walk(col.tree, effective);
  }
  return out;
}
