/**
 * `moveTemplateFolder` — sibling reorder + reparent.
 *
 * Two cases:
 *   1. Intra-parent reorder (`oldParent` undefined or matches `newParent`):
 *      a single `moveBefore` on the parent's `folders` path. LWW per
 *      (setPath, itemId).
 *   2. Reparent (`oldParent` differs from `newParent`): atomic
 *      `removeFromSet(oldParent.folders) + addToSet(newParent.folders)`
 *      with the new orderKey. Per-batch all-or-nothing keeps the folder
 *      from briefly disappearing during the move.
 *
 * Order keys are envelope-resident (§22.1): renderer mints
 * `keyBetween(predKey, anchorKey)` from its current sibling-mirror
 * snapshot before emitting.
 */

import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import {
  TEMPLATE_FOLDER_CHILDREN_PATH,
  type TemplateFolderParentRef,
  type TemplateFolderSlot,
} from './types';

export interface MoveTemplateFolderArgs {
  folderUid: string;
  newParent: TemplateFolderParentRef;
  /** Fractional-indexing key for the new slot position. Required. */
  orderKey: string;
  /** Omit (or pass equal to `newParent`) for intra-parent reorder. */
  oldParent?: TemplateFolderParentRef;
}

export function moveTemplateFolder(
  ctx: MutatorContext,
  args: MoveTemplateFolderArgs,
): MutatorIntent {
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
          path: TEMPLATE_FOLDER_CHILDREN_PATH,
          itemId: args.folderUid,
          orderKey: args.orderKey,
        },
      ]),
      sideEffects: [],
    };
  }

  const slot: TemplateFolderSlot = { uid: args.folderUid };
  const oldParent = args.oldParent as TemplateFolderParentRef;
  const bodies: MutationBody[] = [
    {
      kind: 'removeFromSet',
      type: oldParent.type,
      id: oldParent.uid,
      path: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemId: args.folderUid,
    },
    {
      kind: 'addToSet',
      type: args.newParent.type,
      id: args.newParent.uid,
      path: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemId: args.folderUid,
      item: slot,
      orderKey: args.orderKey,
    },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
