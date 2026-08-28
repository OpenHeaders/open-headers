/**
 * Ordered children of a tree container — the one read rule every
 * sidebar tree builder applies.
 *
 * A container (collection or folder) renders its children as ONE
 * sequence: the merge of its `folders` and `items` sets by key
 * (`mergeOrderedEntries` in the sync order module), folders and
 * leaves interleaved however the user arranged them. The reader hands
 * that merged uid list in; this module resolves it to entities. A
 * child that has no live slot yet — an old-client entity the
 * reconciliation rule has not reached, the boot window before slots
 * land — still belongs to the parent its stored `path` names, so it
 * follows the slotted run in array order, folders then leaves. Never
 * require a slot on read.
 *
 * The index is built once per tree build (one pass over the arrays);
 * every container read is then linear in its own child count.
 */

import { parentPathOf } from './workspace';

/** Child uids of one container, both kinds, in merged slot order. */
export type ContainerSlots = ReadonlyArray<string>;

export interface TreeChildIndex<F, L> {
  folderByUid: ReadonlyMap<string, F>;
  leafByUid: ReadonlyMap<string, L>;
  foldersByParent: ReadonlyMap<string, F[]>;
  leavesByParent: ReadonlyMap<string, L[]>;
}

export function indexTreeChildren<F extends { uid: string }, L extends { uid: string }>(
  folders: ReadonlyArray<F>,
  leaves: ReadonlyArray<L>,
  folderPath: (folder: F) => string,
  leafPath: (leaf: L) => string,
): TreeChildIndex<F, L> {
  const folderByUid = new Map<string, F>();
  const foldersByParent = new Map<string, F[]>();
  for (const folder of folders) {
    folderByUid.set(folder.uid, folder);
    group(foldersByParent, parentPathOf(folderPath(folder)), folder);
  }
  const leafByUid = new Map<string, L>();
  const leavesByParent = new Map<string, L[]>();
  for (const leaf of leaves) {
    leafByUid.set(leaf.uid, leaf);
    group(leavesByParent, parentPathOf(leafPath(leaf)), leaf);
  }
  return { folderByUid, leafByUid, foldersByParent, leavesByParent };
}

function group<T>(into: Map<string, T[]>, parentPath: string | null, entity: T): void {
  if (parentPath === null) return;
  const bucket = into.get(parentPath);
  if (bucket) bucket.push(entity);
  else into.set(parentPath, [entity]);
}

export type OrderedChild<F, L> = { kind: 'folder'; entity: F } | { kind: 'leaf'; entity: L };

/**
 * The children of the container at `parentPath`: slotted children in
 * merged slot order, then the slot-less children whose stored path
 * names this parent (folders, then leaves). `slots` is `null` when the
 * reader has no slot source (no live oracle, no mirror) — pure path
 * order then.
 */
export function orderedChildren<F extends { uid: string }, L extends { uid: string }>(
  index: TreeChildIndex<F, L>,
  parentPath: string,
  slots: ContainerSlots | null,
): OrderedChild<F, L>[] {
  const out: OrderedChild<F, L>[] = [];
  const emitted = new Set<string>();
  for (const uid of slots ?? []) {
    if (emitted.has(uid)) continue;
    const folder = index.folderByUid.get(uid);
    if (folder) {
      emitted.add(uid);
      out.push({ kind: 'folder', entity: folder });
      continue;
    }
    const leaf = index.leafByUid.get(uid);
    if (leaf) {
      emitted.add(uid);
      out.push({ kind: 'leaf', entity: leaf });
    }
  }
  for (const entity of index.foldersByParent.get(parentPath) ?? []) {
    if (emitted.has(entity.uid)) continue;
    emitted.add(entity.uid);
    out.push({ kind: 'folder', entity });
  }
  for (const entity of index.leavesByParent.get(parentPath) ?? []) {
    if (emitted.has(entity.uid)) continue;
    emitted.add(entity.uid);
    out.push({ kind: 'leaf', entity });
  }
  return out;
}
