/**
 * A container's live children, both kinds, merged by key — the one
 * oracle-side read of a collection's or folder's child order. The
 * `folders` and `items` sets share one keyspace and one `(key, uid)`
 * tie-break; every host consumer of the order (the store readers, the
 * tree-order record, the hydration planner) merges through here.
 */

import { mergeOrderedEntries } from '@openheaders/core/sync';
import type { EntityOracle } from './oracle';
import type { FolderTreeKinds } from './post-state/folder-tree-post-state';

export function mergedChildSlots(
  oracle: EntityOracle,
  tree: FolderTreeKinds,
  type: string,
  uid: string,
): ReadonlyArray<{ itemId: string; key: string }> {
  return mergeOrderedEntries(
    oracle.liveOrderedSetItems(type, uid, tree.childrenPath),
    oracle.liveOrderedSetItems(type, uid, tree.itemsPath),
    (slot) => slot.key,
    (slot) => slot.itemId,
  );
}
