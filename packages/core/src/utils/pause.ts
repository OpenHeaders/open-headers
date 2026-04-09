/**
 * Collection/folder pause utilities.
 *
 * Rules can be paused at the collection or folder level.
 * Paused groups store the **paths** of paused collections/folders.
 * A rule is paused if any ancestor path is in the paused set.
 */

/**
 * Check whether a rule's path falls under any paused collection or folder.
 * Uses path-prefix matching — pausing a collection pauses all nested rules.
 */
export function isPathPausedByAncestor(path: string, pausedPaths: ReadonlySet<string>): boolean {
  for (const pp of pausedPaths) {
    if (path.startsWith(`${pp}/`) || path === pp) return true;
  }
  return false;
}
