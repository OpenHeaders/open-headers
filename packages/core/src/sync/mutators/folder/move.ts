/**
 * `moveFolder` — first §7.2 + §23.5 production gesture.
 *
 * Two cases:
 *   1. Intra-parent reorder (`oldParent` undefined or matches `newParent`):
 *      a single `moveBefore` on the parent's `folders` path. LWW per
 *      (setPath, itemId) — concurrent moves of the same folder converge
 *      to the highest-HLC key.
 *   2. Reparent (`oldParent` differs from `newParent`): atomic
 *      `removeFromSet(oldParent.folders) + addToSet(newParent.folders)`
 *      with the new orderKey. Per-batch all-or-nothing at the oracle
 *      keeps observers from seeing the folder vanish from one parent
 *      before reappearing under the other.
 *
 * The folder entity itself is untouched — its scalar `name` survives a
 * move. Slot identity is the folder uid; the slot item is just an
 * existence marker.
 *
 * Order keys are envelope-resident (§22.1): the renderer mints
 * `keyBetween(predKey, anchorKey)` from its current sibling-mirror
 * snapshot before emitting. Replay determinism follows from carrying
 * the key on the wire rather than recomputing at apply time.
 */

import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { FOLDER_CHILDREN_PATH, type FolderParentRef, type FolderSlot } from './types';

export interface MoveFolderArgs {
  folderUid: string;
  newParent: FolderParentRef;
  /** Fractional-indexing key for the new slot position. Required — callers
   *  derive it from their live mirror via `keyBetween(prev, next)`. */
  orderKey: string;
  /** Omit (or pass equal to `newParent`) for intra-parent reorder. */
  oldParent?: FolderParentRef;
}

export function moveFolder(ctx: MutatorContext, args: MoveFolderArgs): MutatorIntent {
  const sameParent =
    !args.oldParent ||
    (args.oldParent.type === args.newParent.type && args.oldParent.uid === args.newParent.uid);

  if (sameParent) {
    return {
      batch: mintBatch(ctx, [
        {
          kind: 'moveBefore',
          type: args.newParent.type,
          id: args.newParent.uid,
          path: FOLDER_CHILDREN_PATH,
          itemId: args.folderUid,
          orderKey: args.orderKey,
        },
      ]),
      sideEffects: [],
    };
  }

  const slot: FolderSlot = { uid: args.folderUid };
  // args.oldParent is defined here because !sameParent ⇒ oldParent !== undefined.
  const oldParent = args.oldParent as FolderParentRef;
  const bodies: MutationBody[] = [
    {
      kind: 'removeFromSet',
      type: oldParent.type,
      id: oldParent.uid,
      path: FOLDER_CHILDREN_PATH,
      itemId: args.folderUid,
    },
    {
      kind: 'addToSet',
      type: args.newParent.type,
      id: args.newParent.uid,
      path: FOLDER_CHILDREN_PATH,
      itemId: args.folderUid,
      item: slot,
      orderKey: args.orderKey,
    },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
