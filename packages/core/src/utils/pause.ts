/**
 * Collection/folder pause utilities — closest-specifier override model.
 *
 * Pause state is a Map<path, 'paused' | 'unpaused'>. An 'unpaused' marker
 * is an explicit override that wins over an ancestor 'paused' marker —
 * the same shape as `.gitignore` (`!pattern`), uBlock exception rules,
 * or LaunchDarkly env-over-org cascades.
 *
 * Resolution: walk from the path upward; the first ancestor (including
 * self) that has any marker decides. Default is unpaused.
 */

import type { CollectionTree, TreeNode } from '../types/collection';

export type PauseMarker = 'paused' | 'unpaused';

/** Read-only view of the marker map — pass this around in render code. */
export type PauseMarkers = ReadonlyMap<string, PauseMarker>;

/**
 * Resolve the effective pause state for a path. Walks ancestors from
 * longest to shortest, returning the state of the first marker hit.
 * Defaults to false (unpaused) when no ancestor is marked.
 */
export function resolvePauseState(path: string, markers: PauseMarkers): boolean {
  if (markers.size === 0) return false;
  let current = path;
  while (current.length > 0) {
    const marker = markers.get(current);
    if (marker === 'paused') return true;
    if (marker === 'unpaused') return false;
    const idx = current.lastIndexOf('/');
    if (idx === -1) return false;
    current = current.slice(0, idx);
  }
  return false;
}

/**
 * Whether any strictly-deeper descendant of `path` carries a marker
 * (paused or unpaused override). Drives the conditional "Clear Nested
 * Overrides" menu entry — we only surface it when the user has explicit
 * markers below this node that the regular self-action wouldn't touch.
 */
export function hasNestedPauseMarkers(path: string, markers: PauseMarkers): boolean {
  if (markers.size === 0) return false;
  const prefix = `${path}/`;
  for (const key of markers.keys()) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
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
      const marker = markers.get(node.path);
      const effective = marker === 'paused' ? true : marker === 'unpaused' ? false : inherited;
      if (effective) out.add(node.uid);
      if (node.type === 'folder') walk(node.children, effective);
    }
  };

  for (const col of trees) {
    const marker = markers.get(col.path);
    // Top-level: nothing to inherit from, default false.
    const effective = marker === 'paused';
    if (effective) out.add(col.uid);
    walk(col.tree, effective);
  }
  return out;
}
