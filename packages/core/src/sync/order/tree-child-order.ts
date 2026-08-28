/**
 * One order across a container's two child sets.
 *
 * A collection or folder keeps its child folders in `folders` and its
 * leaves in `items` — two sets, two conflict units — but the children
 * render as ONE sequence: the merge of both sets by key, the same
 * fractional keyspace, the same `(key, uid)` tie-break the store
 * applies inside a set. A folder keyed between two requests sits
 * between them; nothing floats to the top by kind.
 *
 * Because the two sets share one order, a key minted for a new child
 * of either kind is minted against the container's MERGED tail, and a
 * tree-authored order (`order:` on disk, the persisted tree-order
 * record) plans both sets against one desired sequence. The set paths
 * are the same on every tree (`folders` / `items`), so the scope is
 * a fixed pair.
 */

/** The set paths that share one order on a container. */
export const TREE_CHILD_SET_PATHS: readonly string[] = ['folders', 'items'];

/** The set paths whose keys are ordered together with `setPath` — the pair for a tree child set, the set alone otherwise. */
export function treeOrderScope(setPath: string): readonly string[] {
  return TREE_CHILD_SET_PATHS.includes(setPath) ? TREE_CHILD_SET_PATHS : [setPath];
}

/**
 * Merge two lists already sorted by `(key, id)` into one, by the same
 * rule. Linear; stable for equal `(key, id)` pairs (`a` first).
 */
export function mergeOrderedEntries<T>(
  a: ReadonlyArray<T>,
  b: ReadonlyArray<T>,
  keyOf: (entry: T) => string,
  idOf: (entry: T) => string,
): T[] {
  const out: T[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const x = a[i];
    const y = b[j];
    const kx = keyOf(x);
    const ky = keyOf(y);
    const after = kx > ky || (kx === ky && idOf(x) > idOf(y));
    if (after) {
      out.push(y);
      j += 1;
    } else {
      out.push(x);
      i += 1;
    }
  }
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
}

/** The last key across several ordered lists — the tail a new child appends after; `null` when all are empty. */
export function mergedTailKey(lists: ReadonlyArray<ReadonlyArray<{ orderKey: string }>>): string | null {
  let tail: string | null = null;
  for (const list of lists) {
    const last = list[list.length - 1];
    if (last && (tail === null || last.orderKey > tail)) tail = last.orderKey;
  }
  return tail;
}
