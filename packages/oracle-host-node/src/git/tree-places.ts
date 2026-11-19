/**
 * Places of the working tree and what lies beneath them: a link the
 * folder's listing names, a place the engine's flush was refused at.
 * Asked by a path's own parts, never by a walk of the places — a folder
 * with its dependencies holds links by the thousand.
 */

/** Whether one of `places` is `filePath` itself or a directory above it. */
export function atOrBeneath(places: ReadonlySet<string>, filePath: string): boolean {
  if (places.size === 0) return false;
  for (let cut = filePath.indexOf('/'); cut !== -1; cut = filePath.indexOf('/', cut + 1)) {
    if (places.has(filePath.slice(0, cut))) return true;
  }
  return places.has(filePath);
}
