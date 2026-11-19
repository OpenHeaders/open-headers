/**
 * Places of the working tree and what lies beneath them: a link the
 * folder's listing names, a place the engine's flush was refused at.
 * Asked by a path's own parts, never by a walk of the places — a folder
 * with its dependencies holds links by the thousand.
 *
 * And whether a link stands at one of them now: git's own checkout
 * replaces a link wherever it writes a path beneath it, and its clean
 * takes an uncommitted one away — the engine then reads what git did
 * not write as deleted by hand. While one stands, nothing is checked
 * out (`switch.ts`, the runtime's new branch).
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { failureCode, isGone } from './fs-failure';

/** Whether one of `places` is `filePath` itself or a directory above it. */
export function atOrBeneath(places: ReadonlySet<string>, filePath: string): boolean {
  if (places.size === 0) return false;
  for (let cut = filePath.indexOf('/'); cut !== -1; cut = filePath.indexOf('/', cut + 1)) {
    if (places.has(filePath.slice(0, cut))) return true;
  }
  return places.has(filePath);
}

/**
 * The first of `places` a link stands at, null where none does. Asked of
 * the disk as it is now: a place cleared since the flush was refused at
 * it holds none. On Windows a junction is a link too.
 */
export async function linkStandingAt(rootDir: string, places: readonly string[]): Promise<string | null> {
  for (const place of places) {
    try {
      if ((await fs.lstat(path.join(rootDir, ...place.split('/')))).isSymbolicLink()) return place;
    } catch (err) {
      if (!isGone(failureCode(err))) throw err;
    }
  }
  return null;
}

/** Why nothing is checked out while a link stands at `place`. It never says to take the link away: that reads as a deletion. */
export function checkoutRefusedReason(place: string): string {
  return `"${place}" is a link — nothing is checked out while it stands there; move what it points to back to this place first`;
}
