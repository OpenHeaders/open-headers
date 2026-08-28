/**
 * Ordered children of a tree container — the one read rule every
 * sidebar tree builder applies.
 *
 * A container (collection or folder) renders its child folders first,
 * then its leaves, each run in the order of the parent's slot set
 * (`folders` / `items`). A child that has no live slot yet — an
 * old-client entity the reconciliation rule has not reached, the boot
 * window before slots land — still belongs to the parent its stored
 * `path` names, so it follows the slotted run in array order. Never
 * require a slot on read.
 *
 * The index is built once per tree build (one pass over the arrays);
 * every container read is then linear in its own child count.
 */

import { parentPathOf } from './workspace';

/** Child uids of one container in slot order, per set. */
export interface ContainerSlots {
  folders: ReadonlyArray<string>;
  items: ReadonlyArray<string>;
}

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

export interface OrderedChildren<F, L> {
  folders: F[];
  leaves: L[];
}

/**
 * The children of the container at `parentPath`: slotted children in
 * slot order, then the slot-less children whose stored path names this
 * parent. `slots` is `null` when the reader has no slot source (no live
 * oracle, no mirror) — pure path order then.
 */
export function orderedChildren<F extends { uid: string }, L extends { uid: string }>(
  index: TreeChildIndex<F, L>,
  parentPath: string,
  slots: ContainerSlots | null,
): OrderedChildren<F, L> {
  return {
    folders: orderedRun(slots?.folders ?? [], index.folderByUid, index.foldersByParent.get(parentPath) ?? []),
    leaves: orderedRun(slots?.items ?? [], index.leafByUid, index.leavesByParent.get(parentPath) ?? []),
  };
}

function orderedRun<T extends { uid: string }>(
  slotUids: ReadonlyArray<string>,
  byUid: ReadonlyMap<string, T>,
  byPath: ReadonlyArray<T>,
): T[] {
  if (slotUids.length === 0) return [...byPath];
  const out: T[] = [];
  const emitted = new Set<string>();
  for (const uid of slotUids) {
    const entity = byUid.get(uid);
    if (!entity || emitted.has(uid)) continue;
    emitted.add(uid);
    out.push(entity);
  }
  for (const entity of byPath) {
    if (emitted.has(entity.uid)) continue;
    emitted.add(entity.uid);
    out.push(entity);
  }
  return out;
}
