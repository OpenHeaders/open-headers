/**
 * `renameRequestFolder` — thin adapter over the shared folder-mutator
 * factory. Semantically `setField('name', _)`.
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

export interface RenameRequestFolderArgs {
  folderUid: string;
  name: string;
}

export function renameRequestFolder(
  ctx: MutatorContext,
  args: RenameRequestFolderArgs,
): MutatorIntent {
  return factories.renameFolder(ctx, args);
}
