/**
 * The entries of a branch's own tree that stand in a file's way: a file
 * or a link at a directory above it, a link at its own name. Asked of a
 * commit's listing (`listTreeEntries`), never of the disk.
 *
 * Whose such an entry is, is read three-way. One HEAD holds as the merge
 * base does is both sides': only the foreign side can have taken it
 * away, and its change — a folder in that place — is its to land. One
 * HEAD holds and the base does not, or holds otherwise, is the branch's
 * own since the two parted: the branch keeps it, and a document the
 * foreign change holds beneath it, or at it, cannot stand in the same
 * tree. A pull refuses that before it writes (`pull.ts`); a pass's
 * commit that laid a document over such an entry would take the entry
 * out of the branch (`pass-writes.ts`).
 */

import { isRegularFileEntry, type TreeRefusal } from '../git';

/** A tree's entries as `listTreeEntries` answers them: `path → "<mode> <sha>"`. */
export type TreeEntries = ReadonlyMap<string, string>;

export interface EntryInTheWay {
  /** Where the entry stands, workspace-relative. */
  place: string;
  /** What it is to a file at the path, as the folder's boundary says it. */
  refusal: TreeRefusal;
}

/** The entry of `entries` in the way of a file at `filePath`, null where none is. */
export function entryInTheWay(entries: TreeEntries, filePath: string): EntryInTheWay | null {
  for (let cut = filePath.indexOf('/'); cut !== -1; cut = filePath.indexOf('/', cut + 1)) {
    const dir = filePath.slice(0, cut);
    const entry = entries.get(dir);
    if (entry !== undefined) {
      return { place: dir, refusal: { kind: 'way', dir, stands: isRegularFileEntry(entry) ? 'file' : 'link' } };
    }
  }
  const own = entries.get(filePath);
  if (own === undefined || isRegularFileEntry(own)) return null;
  return { place: filePath, refusal: { kind: 'place', stands: 'link' } };
}

/** Whether `head` holds at `place` the entry `base` holds there: both sides', and the foreign side's alone to replace. */
export function heldByBothSides(base: TreeEntries, head: TreeEntries, place: string): boolean {
  const entry = head.get(place);
  return entry !== undefined && base.get(place) === entry;
}

/**
 * Whether what the DISK holds in the way of a file at `filePath`
 * (`standing`, the boundary's word) is the entry both sides hold there:
 * a link where they hold a link, a file where they hold a file. A link a
 * person put where both sides hold a file, or a folder, is not.
 */
export function standsAsBothSidesHold(
  base: TreeEntries,
  head: TreeEntries,
  filePath: string,
  standing: TreeRefusal,
): boolean {
  const held = entryInTheWay(head, filePath);
  if (held === null || !heldByBothSides(base, head, held.place)) return false;
  const entry = held.refusal;
  if (entry.kind === 'way' && standing.kind === 'way') {
    return entry.dir === standing.dir && entry.stands === standing.stands;
  }
  return entry.kind === 'place' && standing.kind === 'place' && standing.stands === 'link';
}
