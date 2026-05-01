/**
 * `moveFolder` — thin adapter over the shared folder-mutator factory.
 * See `shared/folder-mutators.ts` for the same-parent / reparent
 * invariants.
 */

import { makeFolderMutators } from '../shared/folder-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { FOLDER_CHILDREN_PATH, FOLDER_ENTITY_TYPE, type FolderParentRef } from './types';

const factories = makeFolderMutators<FolderParentRef>({
  entityType: FOLDER_ENTITY_TYPE,
  childrenPath: FOLDER_CHILDREN_PATH,
  mintBatch,
});

export interface MoveFolderArgs {
  folderUid: string;
  newParent: FolderParentRef;
  orderKey: string;
  /** Omit (or pass equal to `newParent`) for intra-parent reorder. */
  oldParent?: FolderParentRef;
}

export function moveFolder(ctx: MutatorContext, args: MoveFolderArgs): MutatorIntent {
  return factories.moveFolder(ctx, args);
}
