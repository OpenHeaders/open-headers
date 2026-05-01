/**
 * `moveRequestFolder` — thin adapter over the shared folder-mutator
 * factory. See `shared/folder-mutators.ts` for the same-parent /
 * reparent invariants.
 */

import { makeFolderMutators } from '../shared/folder-mutators';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import {
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
  type RequestFolderParentRef,
} from './types';

const factories = makeFolderMutators<RequestFolderParentRef>({
  entityType: REQUEST_FOLDER_ENTITY_TYPE,
  childrenPath: REQUEST_FOLDER_CHILDREN_PATH,
  mintBatch,
});

export interface MoveRequestFolderArgs {
  folderUid: string;
  newParent: RequestFolderParentRef;
  orderKey: string;
  /** Omit (or pass equal to `newParent`) for intra-parent reorder. */
  oldParent?: RequestFolderParentRef;
}

export function moveRequestFolder(
  ctx: MutatorContext,
  args: MoveRequestFolderArgs,
): MutatorIntent {
  return factories.moveFolder(ctx, args);
}
